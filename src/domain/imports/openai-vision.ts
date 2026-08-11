import {
  UnconfiguredExtractionProvider,
  type ExtractionProvider,
  type ExtractionProviderResult,
  type ExtractionRequest,
} from "./extraction";

type VisionSmsMessage = {
  rawText?: string | null;
  amountMajor?: number | string | null;
  balanceAfterMajor?: number | string | null;
  accountHint?: string | null;
  direction?: "debit" | "credit" | null;
  visualOrder?: number | null;
  isNewestVisual?: boolean | null;
};

type VisionJson = {
  kind?: "bangkok_bank_sms" | "receipt" | "unknown" | string | null;
  fullText?: string | null;
  messages?: VisionSmsMessage[] | null;
  amountMajor?: number | string | null;
  currency?: string | null;
  description?: string | null;
  merchant?: string | null;
  confidence?: number | null;
};

function majorToMinor(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const raw = typeof value === "number" ? String(value) : String(value);
  const major = Number(raw.replace(/,/g, "").replace(/\s/g, ""));
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

/**
 * OpenAI Vision — candidates only.
 * Bangkok Bank SMS screenshots are first-class: extract EVERY bubble, then
 * domain logic picks the newest unknown payment.
 */
export class OpenAiVisionExtractionProvider implements ExtractionProvider {
  readonly name = "vision_api" as const;

  constructor(private readonly apiKey: string) {}

  async extract(request: ExtractionRequest): Promise<ExtractionProviderResult> {
    if (!request.imageBase64 || !request.mimeType) {
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: { message: "Missing image bytes for vision extraction" },
      };
    }

    const body = {
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You read phone screenshots for a personal finance app (NUMA). " +
            "Bangkok Bank SMS templates (English). Currency may be Bt OR TH OR THB. Balance may say 'available balance is' OR 'Bal available is': " +
            '(1) Debit: "Withdrawal/transfer/payment from your account X6591 of Bt 65.00 via MOBILE; the available balance is Bt 10,693.04." ' +
            '(2) Debit short: "Withdrawal from your account X6591 of Bt 50.00 via MOBILE; the available balance is Bt 12,118.04." ' +
            '(3) Debit alt: "Withdrawal from account XXXXX7 at 08:02 on 2024-08-11 amount THB 3,400.00. Bal available is THB 187,707.04." ' +
            '(4) Credit PromptPay: "PromptPay transfer to your account X6591 of Bt 3,400.00 via MOBILE; the available balance is Bt 10,108.04." ' +
            '(5) Credit MoneyPlus: "MoneyPlus transfer to your account 4181 of TH 3,400.00 via MOBILE; the available balance is TH 7,144.44." ' +
            "A screenshot may show SEVERAL such SMS bubbles. Extract EVERY distinct SMS, oldest→newest by visual conversation order (bottom is usually newest). " +
            "For each SMS: amountMajor = money moved (after of/amount Bt/TH/THB), balanceAfterMajor = remaining balance (after available/Bal available). Never swap them. " +
            "direction = debit for Withdrawal/from, credit for PromptPay/MoneyPlus transfer to / Deposit to / transfer in to. " +
            "Return JSON only with keys: " +
            "kind ('bangkok_bank_sms'|'receipt'|'unknown'), " +
            "fullText (all SMS concatenated with blank lines — keep Bt/TH/THB and wording exactly as written), " +
            "messages (array of {rawText, amountMajor, balanceAfterMajor, accountHint, direction, visualOrder, isNewestVisual}), " +
            "amountMajor, currency (THB|SEK), description, merchant, confidence (0-1). " +
            "For bangkok_bank_sms: prefer exact rawText transcription; do not invent amounts. Never classify a Bangkok Bank SMS thread as receipt. " +
            "For receipts: use final total only. If unclear, null amounts.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract every Bangkok Bank SMS bubble or the receipt total. " +
                "Include PromptPay/MoneyPlus credits (+) and Withdrawals (−). " +
                "Currency token may be Bt, TH, or THB. Prefer kind=bangkok_bank_sms whenever you see bank SMS bubbles.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${request.mimeType};base64,${request.imageBase64}`,
              },
            },
          ],
        },
      ],
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: "OpenAI vision request failed",
          status: res.status,
          body: text.slice(0, 500),
        },
      };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: VisionJson = {};
    try {
      parsed = JSON.parse(content) as VisionJson;
    } catch {
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: { message: "Invalid JSON from vision model", content },
      };
    }

    const kind = parsed.kind ?? "unknown";
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const smsTexts = messages
      .map((m) => (typeof m.rawText === "string" ? m.rawText.trim() : ""))
      .filter(Boolean);
    const fullText =
      (typeof parsed.fullText === "string" && parsed.fullText.trim()) ||
      smsTexts.join("\n\n");

    const currency =
      parsed.currency === "SEK" || parsed.currency === "THB"
        ? parsed.currency
        : ("THB" as const);
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : null;

    const candidates: ExtractionProviderResult["candidates"] =
      kind === "bangkok_bank_sms" && messages.length > 0
        ? messages.map((m) => ({
            direction:
              m.direction === "credit" || m.direction === "debit"
                ? m.direction
                : ("debit" as const),
            amountMinor: majorToMinor(m.amountMajor),
            currency: "THB" as const,
            balanceAfterMinor: majorToMinor(m.balanceAfterMajor),
            occurredAt: null,
            description: m.rawText?.slice(0, 160) ?? null,
            confidence,
            rawPayload: {
              ...(m as Record<string, unknown>),
              rawText: m.rawText ?? null,
              fullText,
            },
          }))
        : [
            {
              direction: "debit" as const,
              amountMinor: majorToMinor(parsed.amountMajor),
              currency,
              balanceAfterMinor: null,
              occurredAt: new Date().toISOString(),
              description:
                [parsed.merchant, parsed.description]
                  .filter(Boolean)
                  .join(" · ") ||
                parsed.description ||
                parsed.merchant ||
                null,
              confidence,
              rawPayload: parsed as Record<string, unknown>,
            },
          ];

    return {
      provider: "vision_api",
      candidates,
      rawMetadata: {
        model: "gpt-4o-mini",
        observationId: request.observationId,
        detectedKind: kind,
        fullText,
        smsTexts,
        messages,
        messageCount: messages.length || (fullText ? 1 : 0),
      },
    };
  }
}

export function createExtractionProvider(): ExtractionProvider {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key) {
    return new OpenAiVisionExtractionProvider(key);
  }
  return new UnconfiguredExtractionProvider();
}
