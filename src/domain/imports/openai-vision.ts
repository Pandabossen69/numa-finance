import {
  UnconfiguredExtractionProvider,
  type ExtractionProvider,
  type ExtractionProviderResult,
  type ExtractionRequest,
} from "./extraction";
import { resolveBankAppPostedCurrency } from "@/domain/imports/bank-app-parsers";
import { resolveImageCurrency } from "@/domain/imports/image-currency";
import { tryEuropeanAmountToMinor, visionMajorToMinor } from "./ocr-amounts";
import { resolveReceiptPaidAmountMinor } from "./receipt-total";

function bankAppMajorToMinor(
  value: number | string | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }
  // Vision may return European strings ("6,60") or western ("6.60").
  return (
    tryEuropeanAmountToMinor(String(value)) ?? visionMajorToMinor(value)
  );
}

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
  /** Mat, Transport, Shopping, Boende, Övrigt, Resor, or Travel. */
  categoryHint?: string | null;
  confidence?: number | null;
};

const VISION_MODEL = "gpt-4o";
const VISION_TEMPERATURE = 0;
const VISION_DETAIL = "high" as const;
const VISION_TIMEOUT_MS = 45_000;
const RAW_CONTENT_CAP = 8_000;

type VisionAttempt = {
  ok: boolean;
  parsed: VisionJson | null;
  model: string;
  httpStatus: number | null;
  error: string | null;
  rawContent: string | null;
  latencyMs: number;
  detail: typeof VISION_DETAIL;
  temperature: typeof VISION_TEMPERATURE;
};

/**
 * True bank-SMS signals only. Do NOT match bare "PromptPay" / "Bangkok" —
 * Thai cafe receipts (Cafe Siam) include both as address + payment method.
 */
function looksLikeBankText(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /available balance is\s+(?:bt|thb?)/.test(t) ||
    /bal(?:ance)?\s+available\s+is\s+(?:bt|thb?)/.test(t) ||
    t.includes("withdrawal/transfer/payment") ||
    t.includes("withdrawal from your account") ||
    t.includes("withdrawal from account") ||
    t.includes("promptpay transfer") ||
    t.includes("moneyplus transfer") ||
    t.includes("deposit/transfer/payment") ||
    (t.includes("from your account") && /(?:bt|thb?)\s*[\d,]/.test(t)) ||
    (t.includes("to your account") && /(?:bt|thb?)\s*[\d,]/.test(t))
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
 * OpenAI Vision — Bangkok Bank SMS, bank-app screenshots, then receipts.
 * Every call uses temperature 0 and image detail high.
 * At most one retry when the read is unknown, empty, or missing a store name.
 */
export class OpenAiVisionExtractionProvider implements ExtractionProvider {
  readonly name = "vision_api" as const;

  constructor(private readonly apiKey: string) {}

  async extract(request: ExtractionRequest): Promise<ExtractionProviderResult> {
    if (!request.imageBase64 || !request.mimeType) {
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: "Missing image bytes for vision extraction",
          temperature: VISION_TEMPERATURE,
          detail: VISION_DETAIL,
          attemptCount: 0,
          attempts: [],
          lastError: "Missing image bytes for vision extraction",
          httpStatus: null,
          latencyMs: null,
          detectedKind: "unknown",
        },
      };
    }

    const preferBank = request.institutionHint === "Bangkok Bank";
    const preferBankApp =
      request.institutionHint === "bank_app" ||
      request.institutionHint === "bunq" ||
      request.institutionHint === "revolut";
    const mode: "bank_sms" | "bank_app" | "general" = preferBank
      ? "bank_sms"
      : preferBankApp
        ? "bank_app"
        : "general";

    const first = await this.callVision(request, { mode });
    const attempts: VisionAttempt[] = [first];
    let chosen = first;
    if (this.needsRetry(first, mode)) {
      const second = await this.callVision(request, {
        mode: this.retryMode(first, mode),
      });
      attempts.push(second);
      chosen = this.preferAttempt(first, second);
    }

    return this.finish(request, chosen, attempts, mode);
  }

  private storeName(parsed: VisionJson): string | null {
    for (const bit of [parsed.merchant, parsed.description]) {
      if (typeof bit === "string" && bit.trim()) return bit.trim();
    }
    const txs = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    for (const tx of txs) {
      if (typeof tx.merchant === "string" && tx.merchant.trim()) return tx.merchant.trim();
    }
    return null;
  }

  private hasMoney(parsed: VisionJson): boolean {
    if (parsed.amountMajor != null && String(parsed.amountMajor).trim() !== "") {
      return true;
    }
    const txs = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    if (txs.some((tx) => tx.amountMajor != null || tx.originalAmountMajor != null)) {
      return true;
    }
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    return messages.some((message) => message.amountMajor != null);
  }

  private isEmptyRead(parsed: VisionJson): boolean {
    const full = typeof parsed.fullText === "string" ? parsed.fullText.trim() : "";
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const txs = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    return !full && messages.length === 0 && txs.length === 0 && !this.hasMoney(parsed) && !this.storeName(parsed);
  }

  /** One extra call when the read is unknown, empty, or has no store/description. */
  private needsRetry(
    pass: VisionAttempt,
    mode: "bank_sms" | "bank_app" | "general",
  ): boolean {
    if (!pass.ok || !pass.parsed) return true;
    const parsed = pass.parsed;
    const kind = String(parsed.kind ?? "").trim();
    if (mode === "bank_sms" || kind === "bangkok_bank_sms") {
      return !this.hasUsableSms(parsed);
    }
    if (
      mode === "bank_app" ||
      kind === "bank_app" ||
      kind === "bank_app_detail" ||
      kind === "bank_app_list"
    ) {
      return !this.storeName(parsed) || !this.hasMoney(parsed);
    }
    if (this.hasUsableSms(parsed)) return false;
    if (!kind || kind === "unknown" || this.isEmptyRead(parsed) || !this.storeName(parsed)) {
      return true;
    }
    return false;
  }

  private retryMode(
    first: VisionAttempt,
    mode: "bank_sms" | "bank_app" | "general",
  ): "bank_sms" | "bank_app" | "general" {
    if (mode !== "general" || !first.ok || !first.parsed) return mode;
    const hint =
      typeof first.parsed.fullText === "string" ? first.parsed.fullText : "";
    const kind = String(first.parsed.kind ?? "");
    if (kind === "bangkok_bank_sms" || looksLikeBankText(hint)) return "bank_sms";
    if (
      kind === "bank_app" ||
      kind === "bank_app_detail" ||
      kind === "bank_app_list" ||
      looksLikeBankAppText(hint)
    ) {
      return "bank_app";
    }
    return "general";
  }

  private scoreAttempt(pass: VisionAttempt): number {
    if (!pass.ok || !pass.parsed) return 0;
    let score = 1;
    const kind = String(pass.parsed.kind ?? "unknown").trim();
    if (kind && kind !== "unknown") score += 1;
    if (this.hasMoney(pass.parsed)) score += 2;
    if (this.storeName(pass.parsed) || this.hasUsableSms(pass.parsed)) score += 2;
    return score;
  }

  /** Keep the first read when the retry is not strictly better, so a stable amount stays. */
  private preferAttempt(first: VisionAttempt, second: VisionAttempt): VisionAttempt {
    return this.scoreAttempt(second) > this.scoreAttempt(first) ? second : first;
  }

  private attemptMetadata(attempts: VisionAttempt[]): Record<string, unknown> {
    const last = attempts[attempts.length - 1];
    const lastError =
      [...attempts].reverse().find((attempt) => attempt.error)?.error ?? null;
    return {
      temperature: VISION_TEMPERATURE,
      detail: VISION_DETAIL,
      attemptCount: attempts.length,
      lastError,
      httpStatus: last?.httpStatus ?? null,
      latencyMs: last?.latencyMs ?? null,
      attempts: attempts.map((attempt, index) => ({
        index: index + 1,
        ok: attempt.ok,
        httpStatus: attempt.httpStatus,
        latencyMs: attempt.latencyMs,
        error: attempt.error,
        rawContent: attempt.rawContent,
        temperature: attempt.temperature,
        detail: attempt.detail,
        kind: attempt.parsed?.kind ?? null,
        description: attempt.parsed ? this.storeName(attempt.parsed) : null,
      })),
    };
  }

  private finish(
    request: ExtractionRequest,
    chosen: VisionAttempt,
    attempts: VisionAttempt[],
    mode: string,
  ): ExtractionProviderResult {
    const meta = this.attemptMetadata(attempts);
    if (!chosen.ok || !chosen.parsed) {
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: chosen.error || "Kunde inte läsa bilden",
          model: VISION_MODEL,
          mode,
          detectedKind: "unknown",
          ...meta,
        },
      };
    }
    const result = this.toResult(request, chosen.parsed, chosen.model || VISION_MODEL, {
      apiCalls: attempts.length,
      mode,
    });
    return {
      ...result,
      rawMetadata: {
        ...result.rawMetadata,
        ...meta,
      },
    };
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

  private async callVision(
    request: ExtractionRequest,
    options: {
      mode: "bank_sms" | "bank_app" | "general";
    },
  ): Promise<VisionAttempt> {
    const model = VISION_MODEL;
    const { mode } = options;
    const started = Date.now();
    const clip = (value: string | null): string | null => {
      if (value == null) return null;
      return value.length > RAW_CONTENT_CAP ? value.slice(0, RAW_CONTENT_CAP) : value;
    };
    const fail = (input: {
      httpStatus: number | null;
      error: string;
      rawContent: string | null;
    }): VisionAttempt => ({
      ok: false,
      parsed: null,
      model,
      httpStatus: input.httpStatus,
      error: input.error,
      rawContent: clip(input.rawContent),
      latencyMs: Date.now() - started,
      detail: VISION_DETAIL,
      temperature: VISION_TEMPERATURE,
    });

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
              "amountMajor/currency = what left the card. currency and originalCurrency are ISO 4217 codes (EUR, SEK, USD, THB), never a symbol. Keep SEK/kr as SEK, THB/฿/บาท as THB, and USD as USD — never rewrite them as EUR. NEVER put a THB merchant amount in the card amount when a separate euro amount is shown. If the row only shows THB, ฿ or บาท, currency is THB.",
              "If FX line like '248.00 THB, 1 THB = 0.02661 EUR' set originalAmountMajor=248, originalCurrency=THB only.",
              "occurredAt is ISO 8601 local time without a timezone suffix, YYYY-MM-DDTHH:mm, for example 2026-07-23T16:46 from '23 juli 2026 16:46'.",
              "direction=debit for payments/onlinebetalning; credit for top-ups/Påfyllning.",
              "failed=true OR strikethrough=true for Failed/Expired/misslyckade (do NOT treat as spend).",
              "categoryHint: Mat, Transport, Shopping, Boende, Övrigt, Resor, or Travel. If the row or image says Resor, Travel, or Transport (airline, AirAsia, flight, train), return that word — Resor or Travel, never null and never Mat. Taxi/Grab/Bolt/fuel → Transport, restaurant/grocery → Mat, retail/webshop → Shopping, rent/utilities → Boende. Never invent a category outside that set.",
              "JSON: kind=bank_app_detail|bank_app_list, institutionHint, fullText, transactions[{merchant,direction,amountMajor,currency,originalAmountMajor,originalCurrency,occurredAt,categoryHint,failed,strikethrough,statusText,rawText}], confidence.",
              "Never invent amounts. Skip UI chrome (Tillbaka, Begär betalning, Dela).",
            ].join(" ")
          : [
              "Read finance screenshots for NUMA.",
              "Bank SMS (Withdrawal/PromptPay/available balance) → kind=bangkok_bank_sms, every bubble.",
              "Bank app (bunq/Revolut/onlinebetalning/€ + merchant) → kind=bank_app_detail or bank_app_list + transactions[]. Card amount = EUR when shown.",
              "Else receipt total → kind=receipt. merchant is the store name and is required when it is visible. currency is the code printed on the receipt (THB, ฿, บาท, EUR, SEK, USD). Never assume EUR.",
              "Receipts and travel screens include categoryHint: Mat, Transport, Shopping, Boende, Övrigt, Resor, or Travel. An airline ticket or the word Resor/Travel/Transport (AirAsia) is Resor or Travel, never Mat and never null.",
              "JSON: kind, institutionHint, fullText, categoryHint, messages[…], transactions[…], amountMajor, currency, merchant, description, confidence.",
            ].join(" ");

    const userText =
      mode === "bank_sms"
        ? "Transcribe every Bangkok Bank SMS bubble top→bottom. Debits and credits. JSON only."
        : mode === "bank_app"
          ? "Extract every real bank-app transaction (skip failed/strikethrough). amountMajor uses the currency printed on the row (THB, ฿, บาท, SEK, EUR or USD). Do not default to EUR. original* is the other currency when an FX line is shown. merchant is the store name. JSON only."
          : "Extract bank SMS bubbles, bank-app transactions, or the receipt total. merchant is the store name. currency is whatever the image prints. JSON only.";

    const body = {
      model,
      temperature: VISION_TEMPERATURE,
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
                detail: VISION_DETAIL,
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
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text();
        return fail({
          httpStatus: res.status,
          error: `Vision API ${res.status}: ${text.slice(0, 180)}`,
          rawContent: text,
        });
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      try {
        const parsed = JSON.parse(content) as VisionJson;
        return {
          ok: true,
          parsed,
          model,
          httpStatus: res.status,
          error: null,
          rawContent: clip(content),
          latencyMs: Date.now() - started,
          detail: VISION_DETAIL,
          temperature: VISION_TEMPERATURE,
        };
      } catch {
        return fail({
          httpStatus: res.status,
          error: "Ogiltigt JSON-svar från vision",
          rawContent: content,
        });
      }
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      return fail({
        httpStatus: null,
        error: timedOut
          ? "Vision-anropet tog för lång tid (timeout)"
          : error instanceof Error
            ? error.message
            : "Nätverksfel mot vision API",
        rawContent: null,
      });
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

    // Bankapp mode stays on bank-app even when the model is unsure.
    if (
      meta.mode === "bank_app" &&
      kind !== "bangkok_bank_sms" &&
      kind !== "bank_app" &&
      kind !== "bank_app_detail" &&
      kind !== "bank_app_list"
    ) {
      kind = txsIn.length > 1 ? "bank_app_list" : "bank_app_detail";
    }

    const currency = resolveImageCurrency({
      explicit: typeof parsed.currency === "string" ? parsed.currency : null,
      texts: [fullText, parsed.merchant, parsed.description],
    });
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
              const displayMinor = bankAppMajorToMinor(t.amountMajor);
              const posted = resolveBankAppPostedCurrency({
                currency: typeof t.currency === "string" ? t.currency : null,
                originalCurrency:
                  t.originalCurrency != null ? String(t.originalCurrency) : null,
                rawText: t.rawText,
                screenText: fullText,
              });
              const ledgerCurrency = posted;
              const ledgerMinor =
                posted && displayMinor != null
                  ? displayMinor
                  : bankAppMajorToMinor(t.originalAmountMajor);
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
                amountMinor: resolveReceiptPaidAmountMinor({
                  visionAmountMinor: visionMajorToMinor(parsed.amountMajor),
                  fullText,
                }),
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
