import {
  UnconfiguredExtractionProvider,
  type ExtractionProvider,
  type ExtractionProviderResult,
  type ExtractionRequest,
} from "./extraction";
import { visionMajorToMinor } from "./ocr-amounts";

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

type VisionBankAppTx = {
  merchant?: string | null;
  direction?: "debit" | "credit" | null;
  amountMajor?: number | string | null;
  currency?: string | null;
  originalAmountMajor?: number | string | null;
  originalCurrency?: string | null;
  occurredAt?: string | null;
  categoryHint?: string | null;
  failed?: boolean | null;
  strikethrough?: boolean | null;
  statusText?: string | null;
  rawText?: string | null;
};

type VisionJson = {
  kind?:
    | "bangkok_bank_sms"
    | "bank_app"
    | "bank_app_detail"
    | "bank_app_list"
    | "receipt"
    | "unknown"
    | string
    | null;
  institutionHint?: string | null;
  fullText?: string | null;
  messages?: VisionSmsMessage[] | null;
  transactions?: VisionBankAppTx[] | null;
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

function looksLikeBankAppText(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("bunq") ||
    t.includes("revolut") ||
    t.includes("zerofx") ||
    t.includes("onlinebetalning") ||
    t.includes("senaste transaktioner") ||
    t.includes("påfyllning av kort") ||
    (t.includes("grab") && (/€|eur|thb/.test(t)))
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
 * OpenAI Vision — Bangkok Bank SMS first-class, bank-app screenshots second.
 * Token rules:
 * - Bank-SMS mode = ONE high-detail call (no duplicate retry with same prompt).
 * - Bank-app / receipt mode = ONE low-detail call; bank SMS retry only if needed.
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
    const preferBankApp =
      request.institutionHint === "bank_app" ||
      request.institutionHint === "bunq" ||
      request.institutionHint === "revolut";
    let apiCalls = 0;

    if (preferBank) {
      apiCalls += 1;
      let pass = await this.callVision(request, {
        mode: "bank_sms",
        detail: "high",
      });
      if (!pass.ok) {
        apiCalls += 1;
        pass = await this.callVision(request, {
          mode: "bank_sms",
          detail: "high",
        });
      }
      if (pass.ok) {
        return this.toResult(request, pass.parsed, pass.model, {
          apiCalls,
          mode: "bank_sms",
        });
      }
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: pass.error || "Kunde inte läsa bilden",
          apiCalls,
          mode: "bank_sms",
        },
      };
    }

    if (preferBankApp) {
      apiCalls += 1;
      let pass = await this.callVision(request, {
        mode: "bank_app",
        detail: "high",
      });
      if (!pass.ok) {
        apiCalls += 1;
        pass = await this.callVision(request, {
          mode: "bank_app",
          detail: "high",
        });
      }
      if (pass.ok) {
        return this.toResult(request, pass.parsed, pass.model, {
          apiCalls,
          mode: "bank_app",
        });
      }
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: pass.error || "Kunde inte läsa bankappen",
          apiCalls,
          mode: "bank_app",
        },
      };
    }

    // Receipt / unknown: cheap first pass (also detects bank app + SMS).
    apiCalls += 1;
    const first = await this.callVision(request, {
      mode: "general",
      detail: "low",
    });
    if (first.ok && this.hasUsableSms(first.parsed)) {
      return this.toResult(request, first.parsed, first.model, {
        apiCalls,
        mode: "receipt_detected_bank",
      });
    }
    if (first.ok && this.hasUsableBankApp(first.parsed)) {
      return this.toResult(request, first.parsed, first.model, {
        apiCalls,
        mode: "receipt_detected_bank_app",
      });
    }
    if (first.ok && this.hasUsableReceipt(first.parsed)) {
      return this.toResult(request, first.parsed, first.model, {
        apiCalls,
        mode: "receipt",
      });
    }

    const hintText =
      (first.ok &&
        typeof first.parsed.fullText === "string" &&
        first.parsed.fullText) ||
      "";
    const shouldBankRetry =
      !first.ok ||
      first.parsed.kind === "bangkok_bank_sms" ||
      looksLikeBankText(hintText);
    const shouldBankAppRetry =
      first.ok &&
      (first.parsed.kind === "bank_app" ||
        first.parsed.kind === "bank_app_detail" ||
        first.parsed.kind === "bank_app_list" ||
        looksLikeBankAppText(hintText));

    if (shouldBankRetry) {
      apiCalls += 1;
      const second = await this.callVision(request, {
        mode: "bank_sms",
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
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: !second.ok ? second.error : "Kunde inte läsa bilden",
          apiCalls,
          mode: "receipt_failed",
        },
      };
    }

    if (shouldBankAppRetry) {
      apiCalls += 1;
      const second = await this.callVision(request, {
        mode: "bank_app",
        detail: "high",
      });
      if (second.ok && this.hasUsableBankApp(second.parsed)) {
        return this.toResult(request, second.parsed, second.model, {
          apiCalls,
          mode: "receipt_bank_app_retry",
        });
      }
      if (first.ok) {
        return this.toResult(request, first.parsed, first.model, {
          apiCalls,
          mode: "receipt_fallback",
        });
      }
    }

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

  private hasUsableBankApp(parsed: VisionJson): boolean {
    if (
      parsed.kind === "bank_app" ||
      parsed.kind === "bank_app_detail" ||
      parsed.kind === "bank_app_list"
    ) {
      const txs = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      if (txs.some((t) => t.amountMajor != null || t.originalAmountMajor != null)) {
        return true;
      }
    }
    const fullText = typeof parsed.fullText === "string" ? parsed.fullText : "";
    return looksLikeBankAppText(fullText);
  }

  private hasUsableReceipt(parsed: VisionJson): boolean {
    if (
      parsed.kind === "bangkok_bank_sms" ||
      parsed.kind === "bank_app" ||
      parsed.kind === "bank_app_detail" ||
      parsed.kind === "bank_app_list"
    ) {
      return false;
    }
    return visionMajorToMinor(parsed.amountMajor) != null;
  }

  private async callVision(
    request: ExtractionRequest,
    options: {
      mode: "bank_sms" | "bank_app" | "general";
      detail: "high" | "low";
    },
  ): Promise<VisionCallOk | VisionCallFail> {
    const model = "gpt-4o";
    const { mode, detail } = options;

    const system =
      mode === "bank_sms"
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
            "Digit care: 0 vs O, 1 vs l — prefer digits next to Bt/THB amounts.",
          ].join(" ")
        : mode === "bank_app"
          ? [
              "Expert OCR for European bank-app screenshots (bunq, Revolut).",
              "Handle DETAIL screens (one payment) and LIST screens (Senaste transaktioner).",
              "Swedish UI OK. Comma decimals: 6,60 € → amountMajor 6.60 currency EUR.",
              "If FX line like '248.00 THB, 1 THB = 0.02661 EUR' set originalAmountMajor=248, originalCurrency=THB.",
              "occurredAt as ISO minute: 2026-07-23T16:46 from '23 juli 2026 16:46'.",
              "direction=debit for payments/onlinebetalning; credit for top-ups/Påfyllning.",
              "failed=true OR strikethrough=true for Failed/Expired/misslyckade (do NOT treat as spend).",
              "JSON: kind=bank_app_detail|bank_app_list, institutionHint, fullText, transactions[{merchant,direction,amountMajor,currency,originalAmountMajor,originalCurrency,occurredAt,categoryHint,failed,strikethrough,statusText,rawText}], confidence.",
              "Never invent amounts. Skip UI chrome (Tillbaka, Begär betalning, Dela).",
            ].join(" ")
          : [
              "Read finance screenshots for NUMA.",
              "Bank SMS (Withdrawal/PromptPay/available balance) → kind=bangkok_bank_sms, every bubble.",
              "Bank app (bunq/Revolut/onlinebetalning/€ + merchant) → kind=bank_app_detail or bank_app_list + transactions[].",
              "Else receipt total → kind=receipt.",
              "JSON: kind, institutionHint, fullText, messages[…], transactions[…], amountMajor, currency, confidence.",
            ].join(" ");

    const userText =
      mode === "bank_sms"
        ? "Transcribe every Bangkok Bank SMS bubble top→bottom. Debits and credits. JSON only."
        : mode === "bank_app"
          ? "Extract every real bank-app transaction (skip failed/strikethrough). Prefer THB original when present. JSON only."
          : "Extract bank SMS bubbles, bank-app transactions, or receipt total. JSON only.";

    const body = {
      model,
      temperature: 0,
      max_tokens: mode === "bank_sms" || mode === "bank_app" ? 1400 : 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
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
    const txsIn = Array.isArray(parsed.transactions) ? parsed.transactions : [];

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
      smsTexts.join("\n\n") ||
      txsIn.map((t) => t.rawText).filter(Boolean).join("\n");

    if (
      kind !== "bangkok_bank_sms" &&
      (looksLikeBankText(fullText) || normalizedMessages.length > 0) &&
      !looksLikeBankAppText(fullText)
    ) {
      kind = "bangkok_bank_sms";
    }

    if (
      (kind === "unknown" || kind === "receipt") &&
      (txsIn.length > 0 || looksLikeBankAppText(fullText))
    ) {
      kind = txsIn.length > 1 ? "bank_app_list" : "bank_app_detail";
    }

    const currency =
      parsed.currency === "SEK" || parsed.currency === "THB"
        ? parsed.currency
        : ("THB" as const);
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : null;

    const isBankApp =
      kind === "bank_app" ||
      kind === "bank_app_detail" ||
      kind === "bank_app_list";

    const candidates: ExtractionProviderResult["candidates"] =
      kind === "bangkok_bank_sms" && normalizedMessages.length > 0
        ? normalizedMessages.map((m) => ({
            direction:
              m.direction === "credit" || m.direction === "debit"
                ? m.direction
                : null,
            amountMinor: visionMajorToMinor(m.amountMajor),
            currency: "THB" as const,
            balanceAfterMinor: visionMajorToMinor(m.balanceAfterMajor),
            occurredAt: null,
            description: m.rawText?.slice(0, 160) ?? null,
            confidence,
            rawPayload: {
              ...(m as Record<string, unknown>),
              rawText: m.rawText ?? null,
              fullText,
            },
          }))
        : isBankApp && txsIn.length > 0
          ? txsIn.map((t) => {
              const origMinor = visionMajorToMinor(t.originalAmountMajor);
              const displayMinor = visionMajorToMinor(t.amountMajor);
              const origCur = t.originalCurrency
                ? String(t.originalCurrency).toUpperCase()
                : null;
              const ledgerCurrency =
                origCur === "THB" || origCur === "SEK"
                  ? (origCur as "THB" | "SEK")
                  : t.currency === "THB" || t.currency === "SEK"
                    ? t.currency
                    : ("THB" as const);
              const ledgerMinor =
                origMinor != null && (origCur === "THB" || origCur === "SEK")
                  ? origMinor
                  : displayMinor;
              return {
                direction:
                  t.direction === "credit" || t.direction === "debit"
                    ? t.direction
                    : ("debit" as const),
                amountMinor: ledgerMinor,
                currency: ledgerCurrency,
                balanceAfterMinor: null,
                occurredAt: t.occurredAt ?? null,
                description: t.merchant ?? t.rawText?.slice(0, 160) ?? null,
                confidence,
                rawPayload: {
                  ...(t as Record<string, unknown>),
                  merchant: t.merchant ?? null,
                  originalAmountMajor: t.originalAmountMajor ?? null,
                  originalCurrency: t.originalCurrency ?? null,
                  failed: t.failed === true,
                  strikethrough: t.strikethrough === true,
                  statusText: t.statusText ?? null,
                  rawText: t.rawText ?? null,
                  fullText,
                },
              };
            })
          : [
              {
                direction: "debit" as const,
                amountMinor: visionMajorToMinor(parsed.amountMajor),
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
        institutionHint: parsed.institutionHint ?? null,
        fullText,
        smsTexts,
        messages: normalizedMessages,
        transactions: txsIn,
        messageCount:
          normalizedMessages.length ||
          txsIn.length ||
          (fullText ? 1 : 0),
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
