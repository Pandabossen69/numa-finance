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
  const major =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(major) || major <= 0) return null;
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
            "Bangkok Bank payment SMS almost always looks like: " +
            '"Withdrawal/transfer/payment from your account X6591 of Bt 65.00 via MOBILE; the available balance is Bt 10,693.04." ' +
            "A screenshot may show SEVERAL such SMS. Extract EVERY distinct SMS, oldest→newest by visual conversation order when possible. " +
            "Return JSON only with keys: " +
            "kind ('bangkok_bank_sms'|'receipt'|'unknown'), " +
            "fullText (all SMS concatenated with blank lines), " +
            "messages (array of {rawText, amountMajor, balanceAfterMajor, accountHint, direction, visualOrder, isNewestVisual}), " +
            "amountMajor, currency (THB|SEK), description, merchant, confidence (0-1). " +
            "For bangkok_bank_sms: prefer exact rawText transcription; do not invent amounts. " +
            "For receipts: use final total only. If unclear, null amounts.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract bank SMS messages or receipt total from this image. " +
                "If multiple Bangkok Bank SMS are visible, include all of them.",
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

/**
 * OCR Bangkok Bank (or similar) SMS screenshot → plain text only.
 * Domain parsers turn the text into fingerprint-ready candidates.
 */
export async function extractBankSmsPlainText(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<{
  text: string | null;
  provider: "vision_api" | "none";
  rawMetadata: Record<string, unknown>;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: null,
      provider: "none",
      rawMetadata: {
        message:
          "OCR/vision is not configured. Paste the SMS text instead.",
      },
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
          "You OCR bank SMS screenshots for a personal finance app. " +
          "Return JSON with key `text`: the full readable SMS thread as plain text, " +
          "preserving each message in order (oldest to newest if visible). " +
          "Keep amounts, account masks (e.g. X6591), and 'available balance' lines exactly. " +
          "Do not invent messages. If unreadable, return text as empty string.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all Bangkok Bank / bank SMS message text from this screenshot.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${input.mimeType};base64,${input.imageBase64}`,
            },
          },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      text: null,
      provider: "vision_api",
      rawMetadata: {
        message: "OpenAI vision request failed",
        status: res.status,
        body: errText.slice(0, 500),
      },
    };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content) as { text?: unknown };
    const text =
      typeof parsed.text === "string" ? parsed.text.trim() : "";
    return {
      text: text || null,
      provider: "vision_api",
      rawMetadata: { model: "gpt-4o-mini" },
    };
  } catch {
    return {
      text: null,
      provider: "vision_api",
      rawMetadata: { message: "Invalid JSON from vision model", content },
    };
  }
}
