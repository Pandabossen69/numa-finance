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
  channel?: string | null;
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

type VisionCallOk = { ok: true; parsed: VisionJson; model: string };
type VisionCallFail = {
  ok: false;
  error: string;
  parsed?: undefined;
  model?: undefined;
};

function majorToMinor(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const raw = typeof value === "number" ? String(value) : String(value);
  const major = Number(raw.replace(/,/g, "").replace(/\s/g, ""));
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

function looksLikeBankText(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /available balance is\s+(?:bt|thb?)/.test(t) ||
    /bal(?:ance)?\s+available\s+is\s+(?:bt|thb?)/.test(t) ||
    t.includes("withdrawal") ||
    t.includes("promptpay") ||
    t.includes("moneyplus") ||
    t.includes("bangkok")
  );
}

function synthesizeRawText(m: VisionSmsMessage): string | null {
  if (typeof m.rawText === "string" && m.rawText.trim()) return m.rawText.trim();
  if (m.amountMajor == null || m.balanceAfterMajor == null) return null;
  if (m.direction !== "credit" && m.direction !== "debit") return null;
  const account = (m.accountHint ?? "X0000").toString().trim() || "X0000";
  const amount = String(m.amountMajor).replace(/,/g, "");
  const balance = String(m.balanceAfterMajor).replace(/,/g, "");
  const via = m.channel?.toLowerCase() === "atm" ? "ATM" : "MOBILE";
  if (m.direction === "credit") {
    return `PromptPay transfer to your account ${account} of Bt ${amount} via ${via}; the available balance is Bt ${balance}.`;
  }
  return `Withdrawal/transfer/payment from your account ${account} of Bt ${amount} via ${via}; the available balance is Bt ${balance}.`;
}

/**
 * OpenAI Vision — Bangkok Bank SMS first-class.
 * Token rules:
 * - Bank-SMS mode = ONE high-detail call (no duplicate retry with same prompt).
 * - Receipt mode = ONE low-detail call; bank retry only if the image looks like SMS.
 * - API/transport errors get one retry; weak JSON does not.
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

    const preferBank = request.institutionHint === "Bangkok Bank";
    let apiCalls = 0;

    if (preferBank) {
      apiCalls += 1;
      let pass = await this.callVision(request, {
        bankForced: true,
        detail: "high",
      });
      if (!pass.ok) {
        // Only burn a second call on transport/API failure — never same prompt twice for "weak OCR".
        apiCalls += 1;
        pass = await this.callVision(request, {
          bankForced: true,
          detail: "high",
        });
      }
      if (pass.ok) {
        return this.toResult(request, pass.parsed, pass.model, {
          apiCalls,
          mode: "bank_sms",
        });
      }
      const bankError = pass.error;
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: bankError || "Kunde inte läsa bilden",
          apiCalls,
          mode: "bank_sms",
        },
      };
    }

    // Receipt / unknown: cheap first pass.
    apiCalls += 1;
    const first = await this.callVision(request, {
      bankForced: false,
      detail: "low",
    });
    if (first.ok && this.hasUsableSms(first.parsed)) {
      return this.toResult(request, first.parsed, first.model, {
        apiCalls,
        mode: "receipt_detected_bank",
      });
    }
    if (first.ok && this.hasUsableReceipt(first.parsed)) {
      return this.toResult(request, first.parsed, first.model, {
        apiCalls,
        mode: "receipt",
      });
    }

    // Bank retry only when the cheap pass hints at SMS but didn't extract bubbles.
    const hintText =
      (first.ok &&
        typeof first.parsed.fullText === "string" &&
        first.parsed.fullText) ||
      "";
    const shouldBankRetry =
      !first.ok ||
      first.parsed.kind === "bangkok_bank_sms" ||
      looksLikeBankText(hintText);

    if (shouldBankRetry) {
      apiCalls += 1;
      const second = await this.callVision(request, {
        bankForced: true,
        detail: "high",
      });
      if (second.ok && this.hasUsableSms(second.parsed)) {
        return this.toResult(request, second.parsed, second.model, {
          apiCalls,
          mode: "receipt_bank_retry",
        });
      }
      if (first.ok) {
        return this.toResult(request, first.parsed, first.model, {
          apiCalls,
          mode: "receipt_fallback",
        });
      }
      const failMsg = !second.ok
        ? second.error
        : "Kunde inte läsa bilden";
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: failMsg,
          apiCalls,
          mode: "receipt_failed",
        },
      };
    }

    // shouldBankRetry is false ⇒ first.ok is true (see condition above).
    return this.toResult(request, first.parsed, first.model, {
      apiCalls,
      mode: "receipt",
    });
  }

  private hasUsableSms(parsed: VisionJson): boolean {
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const fullText =
      (typeof parsed.fullText === "string" && parsed.fullText) ||
      messages.map((m) => m.rawText).filter(Boolean).join("\n");
    if (
      messages.some(
        (m) => m.amountMajor != null && m.balanceAfterMajor != null,
      )
    ) {
      return true;
    }
    return looksLikeBankText(fullText);
  }

  private hasUsableReceipt(parsed: VisionJson): boolean {
    if (parsed.kind === "bangkok_bank_sms") return false;
    return majorToMinor(parsed.amountMajor) != null;
  }

  private async callVision(
    request: ExtractionRequest,
    options: { bankForced: boolean; detail: "high" | "low" },
  ): Promise<VisionCallOk | VisionCallFail> {
    const model = "gpt-4o";
    const { bankForced, detail } = options;
    const system = bankForced
      ? [
          "Expert OCR for Bangkok Bank iMessage/SMS screenshots.",
          "Read EVERY grey bubble. Bottom ≈ newest.",
          "Templates (Bt/TH/THB):",
          'Debit: "Withdrawal/transfer/payment from your account X6591 of Bt 5,000.00 via ATM; the available balance is Bt 7,028.04."',
          'Debit short: "Withdrawal from your account X6591 of Bt 50.00 via MOBILE; the available balance is Bt 12,028.04."',
          'Credit: "PromptPay transfer to your account X6591 of Bt 3,400.00 via MOBILE; the available balance is Bt 10,108.04"',
          "amountMajor = moved amount. balanceAfterMajor = available balance. NEVER swap.",
          "direction=debit for Withdrawal; credit for PromptPay/MoneyPlus to account.",
          "JSON: kind=bangkok_bank_sms, fullText, messages[{rawText,amountMajor,balanceAfterMajor,accountHint,direction,channel,visualOrder,isNewestVisual}], currency=THB, confidence.",
          "Never invent numbers. Ignore UI chrome (idag, Textmeddelande).",
        ].join(" ")
      : [
          "Read finance screenshots for NUMA.",
          "Bank SMS (Withdrawal/PromptPay/available balance) → kind=bangkok_bank_sms, every bubble.",
          "Else receipt total → kind=receipt.",
          "JSON: kind, fullText, messages[{rawText,amountMajor,balanceAfterMajor,accountHint,direction,channel,visualOrder,isNewestVisual}], amountMajor, currency, confidence.",
        ].join(" ");

    const body = {
      model,
      temperature: 0,
      // 4–6 bubbles fit well under 1200; avoids paying for unused completion headroom.
      max_tokens: bankForced ? 1400 : 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: bankForced
                ? "Transcribe every Bangkok Bank SMS bubble top→bottom. Debits and credits. JSON only."
                : "Extract bank SMS bubbles or receipt total. JSON only.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${request.mimeType};base64,${request.imageBase64}`,
                detail,
              },
            },
          ],
        },
      ],
    };

    try {
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
          ok: false,
          error: `Vision API ${res.status}: ${text.slice(0, 180)}`,
        };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      try {
        return {
          ok: true,
          parsed: JSON.parse(content) as VisionJson,
          model,
        };
      } catch {
        return { ok: false, error: "Ogiltigt JSON-svar från vision" };
      }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nätverksfel mot vision API",
      };
    }
  }

  private toResult(
    request: ExtractionRequest,
    parsed: VisionJson,
    model: string,
    meta: { apiCalls: number; mode: string },
  ): ExtractionProviderResult {
    let kind = parsed.kind ?? "unknown";
    const messagesIn = Array.isArray(parsed.messages) ? parsed.messages : [];

    const normalizedMessages = messagesIn.map((m, index) => {
      const rawText = synthesizeRawText(m);
      return {
        ...m,
        rawText,
        visualOrder:
          typeof m.visualOrder === "number" ? m.visualOrder : index,
      };
    });

    const smsTexts = normalizedMessages
      .map((m) => (typeof m.rawText === "string" ? m.rawText.trim() : ""))
      .filter(Boolean);

    const fullText =
      (typeof parsed.fullText === "string" && parsed.fullText.trim()) ||
      smsTexts.join("\n\n");

    if (
      kind !== "bangkok_bank_sms" &&
      (looksLikeBankText(fullText) || normalizedMessages.length > 0)
    ) {
      kind = "bangkok_bank_sms";
    }

    const currency =
      parsed.currency === "SEK" || parsed.currency === "THB"
        ? parsed.currency
        : ("THB" as const);
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : null;

    const candidates: ExtractionProviderResult["candidates"] =
      kind === "bangkok_bank_sms" && normalizedMessages.length > 0
        ? normalizedMessages.map((m) => ({
            direction:
              m.direction === "credit" || m.direction === "debit"
                ? m.direction
                : null,
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
        model,
        observationId: request.observationId,
        detectedKind: kind,
        fullText,
        smsTexts,
        messages: normalizedMessages,
        messageCount: normalizedMessages.length || (fullText ? 1 : 0),
        apiCalls: meta.apiCalls,
        mode: meta.mode,
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
