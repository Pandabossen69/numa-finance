import {
  UnconfiguredExtractionProvider,
  type ExtractionProvider,
  type ExtractionProviderResult,
  type ExtractionRequest,
} from "./extraction";
import { majorToMinor } from "./amount-parse";
import { resolveReceiptPaidAmountMinor } from "./receipt-total";

type VisionSmsMessage = {
  rawText?: string | null;
  amountMajor?: number | string | null;
  /** Exact digit string as printed, e.g. "3400.00" or "฿749" */
  amountText?: string | null;
  balanceAfterMajor?: number | string | null;
  balanceText?: string | null;
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
  /** Exact total as printed on the receipt (prefer over amountMajor). */
  amountText?: string | null;
  currency?: string | null;
  description?: string | null;
  merchant?: string | null;
  confidence?: number | null;
  /** True when digits were hard to read / blurry / cut off. */
  unclear?: boolean | null;
};

type VisionCallOk = { ok: true; parsed: VisionJson; model: string };
type VisionCallFail = {
  ok: false;
  error: string;
  parsed?: undefined;
  model?: undefined;
};

function amountFromVision(
  text: string | null | undefined,
  major: number | string | null | undefined,
): number | null {
  return majorToMinor(text) ?? majorToMinor(major);
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
  if (m.amountMajor == null && m.amountText == null) return null;
  if (m.balanceAfterMajor == null && m.balanceText == null) return null;
  if (m.direction !== "credit" && m.direction !== "debit") return null;
  const account = (m.accountHint ?? "X0000").toString().trim() || "X0000";
  const amount = String(m.amountText ?? m.amountMajor ?? "").replace(/,/g, "");
  const balance = String(m.balanceText ?? m.balanceAfterMajor ?? "").replace(
    /,/g,
    "",
  );
  if (!amount || !balance) return null;
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

    // Receipt / unknown: high detail so Grab Final total digits stay sharp.
    apiCalls += 1;
    const first = await this.callVision(request, {
      bankForced: false,
      detail: "high",
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
        (m) =>
          (m.amountMajor != null || m.amountText != null) &&
          (m.balanceAfterMajor != null || m.balanceText != null),
      )
    ) {
      return true;
    }
    return looksLikeBankText(fullText);
  }

  private hasUsableReceipt(parsed: VisionJson): boolean {
    if (parsed.kind === "bangkok_bank_sms") return false;
    const visionMinor = amountFromVision(parsed.amountText, parsed.amountMajor);
    if (visionMinor != null) return true;
    // Labeled totals in fullText (e.g. Grab Final total) count even if amountMajor missing.
    return (
      resolveReceiptPaidAmountMinor({
        visionAmountMinor: null,
        fullText: typeof parsed.fullText === "string" ? parsed.fullText : null,
      }) != null
    );
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
          "amountText/balanceText = EXACT digit strings as printed (keep commas/dots). Never invent or round.",
          "amountMajor/balanceAfterMajor = same values as numbers. NEVER swap amount and balance.",
          "direction=debit for Withdrawal; credit for PromptPay/MoneyPlus to account.",
          "Set confidence 0–1 and unclear=true if blurry/cut off.",
          "JSON: kind=bangkok_bank_sms, fullText, messages[{rawText,amountText,amountMajor,balanceText,balanceAfterMajor,accountHint,direction,channel,visualOrder,isNewestVisual}], currency=THB, confidence, unclear.",
          "Ignore UI chrome (idag, Textmeddelande).",
        ].join(" ")
      : [
          "Expert receipt OCR for NUMA personal finance.",
          "Goal: the amount the customer ACTUALLY PAID after discounts/adjustments.",
          "Priority labels (highest first): Final total, Amount paid, Total paid, You paid, Grand total, Total due, Att betala, Totalt, Summa, Total.",
          "Grab / delivery apps: use \"Final total\" (e.g. ฿749), NEVER the earlier order total (฿875) and NEVER Adjustment (-฿126).",
          "Ignore: line items, subtotal, tip suggestions, change, tax alone, promo banners, star ratings.",
          "amountText = EXACT digits as printed next to that label (keep ฿/,/. e.g. \"749\" or \"85.50\"). Never invent or round.",
          "amountMajor = same total as a number. currency THB or SEK. merchant e.g. Grab.",
          "Always put the full visible money block into fullText so Final total can be verified.",
          "Bank SMS (Withdrawal/PromptPay/available balance) → kind=bangkok_bank_sms with every bubble instead.",
          "Else kind=receipt. confidence 0–1; unclear=true if blurry/glare/cut off.",
          "JSON: kind, fullText, amountText, amountMajor, currency, merchant, description, confidence, unclear, messages[...].",
        ].join(" ");

    const body = {
      model,
      temperature: 0,
      max_tokens: bankForced ? 1400 : 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: bankForced
                ? "Transcribe every Bangkok Bank SMS bubble top→bottom with EXACT amounts. JSON only."
                : "Read what was ACTUALLY PAID (Final total / Amount paid). Include fullText. If bank SMS, extract bubbles. JSON only.",
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
        : parsed.unclear === true
          ? 0.45
          : null;

    const candidates: ExtractionProviderResult["candidates"] =
      kind === "bangkok_bank_sms" && normalizedMessages.length > 0
        ? normalizedMessages.map((m) => ({
            direction:
              m.direction === "credit" || m.direction === "debit"
                ? m.direction
                : null,
            amountMinor: amountFromVision(m.amountText, m.amountMajor),
            currency: "THB" as const,
            balanceAfterMinor: amountFromVision(
              m.balanceText,
              m.balanceAfterMajor,
            ),
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
            (() => {
              const visionMinor = amountFromVision(
                parsed.amountText,
                parsed.amountMajor,
              );
              const amountMinor = resolveReceiptPaidAmountMinor({
                visionAmountMinor: visionMinor,
                fullText,
              });
              return {
                direction: "debit" as const,
                amountMinor,
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
                rawPayload: {
                  ...(parsed as Record<string, unknown>),
                  visionAmountMinor: visionMinor,
                  resolvedFromPaidTotalLabel:
                    amountMinor != null &&
                    visionMinor != null &&
                    amountMinor !== visionMinor,
                },
              };
            })(),
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
        confidence,
        unclear: parsed.unclear === true,
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
