/**
 * Bank-app ledger posting policy.
 *
 * Financial truth for card apps (bunq / Revolut):
 * - Post in the **account currency** that left the card (usually EUR).
 * - Keep merchant-local amounts (THB) as annotation / FX context only.
 * - Never invent FX. Optional audited conversion only with an explicit OCR rate
 *   when the caller asks to mirror into the primary (THB) ledger.
 *
 * Modes:
 * - `native` — write amount in cand currency to a matching-currency account
 * - `fx_to_primary` — convert with explicit OCR rate into primaryCurrency
 * - `unsupported` — do not write
 */

import {
  isCurrencyCode,
  parseCurrencyToken,
  type CurrencyCode,
} from "@/domain/money/currency";
import { convertWithRate } from "@/domain/money/fx";
import { money } from "@/domain/money";
import { findOcrFxRate, parseOcrFxQuotes } from "@/domain/imports/fx-ocr";
import type { BankAppInstitution } from "@/domain/imports/bank-app-parsers";

export type BankAppLedgerMode = "native" | "fx_to_primary" | "unsupported";

export type BankAppLedgerPlan =
  | {
      mode: "native";
      amountMinor: number;
      currency: CurrencyCode;
      accountInstitution: string;
      accountName: string;
      annotationSv: string | null;
      fx: null;
    }
  | {
      mode: "fx_to_primary";
      amountMinor: number;
      currency: CurrencyCode;
      accountInstitution: string;
      accountName: string;
      annotationSv: string | null;
      fx: {
        originalAmountMinor: number;
        originalCurrency: CurrencyCode;
        rate: number;
        rateAsOf: string;
        rateSource: string;
      };
    }
  | {
      mode: "unsupported";
      reasonSv: string;
    };

export type BankAppLedgerInput = {
  institution: BankAppInstitution | string;
  merchant: string;
  direction: "debit" | "credit";
  /** Amount charged on the card / account (preferred). */
  displayAmountMinor: number | null;
  displayCurrency: string | null;
  /** Merchant-local amount when OCR shows FX line. */
  originalAmountMinor: number | null;
  originalCurrency: string | null;
  rawText?: string | null;
  fullText?: string | null;
  /** User primary currency (usually THB). */
  primaryCurrency?: CurrencyCode;
  /**
   * When true and an OCR rate exists, convert card currency → primary.
   * Default false — prefer native multi-currency accounts.
   */
  preferFxToPrimary?: boolean;
  occurredAt?: string | null;
};

function institutionLabel(institution: string): { name: string; institution: string } {
  const id = institution.trim().toLowerCase();
  if (id.includes("bunq")) return { name: "bunq", institution: "bunq" };
  if (id.includes("revolut")) return { name: "Revolut", institution: "Revolut" };
  return { name: "Bankapp", institution: institution || "bank_app" };
}

function annotationFor(input: {
  displayCurrency: CurrencyCode | null;
  originalAmountMinor: number | null;
  originalCurrency: CurrencyCode | null;
}): string | null {
  if (
    input.originalAmountMinor != null &&
    input.originalCurrency &&
    input.displayCurrency &&
    input.originalCurrency !== input.displayCurrency
  ) {
    const major = (input.originalAmountMinor / 100).toFixed(2).replace(".", ",");
    return `≈ ${major} ${input.originalCurrency}`;
  }
  return null;
}

/**
 * Decide how a bank-app row becomes ledger money.
 * Prefer the card/account currency (what actually moved).
 */
export function planBankAppLedger(input: BankAppLedgerInput): BankAppLedgerPlan {
  const displayCur = parseCurrencyToken(input.displayCurrency);
  const originalCur = parseCurrencyToken(input.originalCurrency);
  const primary = input.primaryCurrency ?? "THB";
  const labels = institutionLabel(String(input.institution));
  const text = [input.rawText, input.fullText].filter(Boolean).join("\n");
  const asOf = input.occurredAt ?? new Date().toISOString();

  const displayOk =
    displayCur &&
    input.displayAmountMinor != null &&
    input.displayAmountMinor > 0
      ? { amountMinor: input.displayAmountMinor, currency: displayCur }
      : null;

  const originalOk =
    originalCur &&
    input.originalAmountMinor != null &&
    input.originalAmountMinor > 0
      ? { amountMinor: input.originalAmountMinor, currency: originalCur }
      : null;

  // Card currency first — that is what left bunq/Revolut.
  const native = displayOk ?? originalOk;
  if (!native) {
    return {
      mode: "unsupported",
      reasonSv:
        "Kunde inte avgöra valuta/belopp för bankappen (stöd: EUR, THB, SEK).",
    };
  }

  const note = annotationFor({
    displayCurrency: displayOk?.currency ?? null,
    originalAmountMinor: originalOk?.amountMinor ?? null,
    originalCurrency: originalOk?.currency ?? null,
  });

  if (
    input.preferFxToPrimary &&
    native.currency !== primary &&
    text.trim()
  ) {
    const rate = findOcrFxRate(text, native.currency, primary, {
      asOf,
      source: "bank_app_ocr",
    });
    if (rate) {
      const converted = convertWithRate(
        money(native.amountMinor, native.currency),
        primary,
        rate,
      );
      return {
        mode: "fx_to_primary",
        amountMinor: converted.converted.amountMinor,
        currency: primary,
        accountInstitution: labels.institution,
        accountName:
          primary === "THB" ? "Bangkok Bank" : labels.name,
        annotationSv: note,
        fx: {
          originalAmountMinor: native.amountMinor,
          originalCurrency: native.currency,
          rate: rate.rate,
          rateAsOf: rate.asOf,
          rateSource: rate.source,
        },
      };
    }
  }

  // Enrich annotation from OCR quotes when original amount missing.
  let enrichedNote = note;
  if (!enrichedNote && text.trim() && displayOk) {
    const quotes = parseOcrFxQuotes(text, { asOf, source: "bank_app_ocr" });
    const withOrig = quotes.find(
      (q) =>
        q.originalAmountMinor != null &&
        q.originalCurrency &&
        isCurrencyCode(q.originalCurrency),
    );
    if (withOrig?.originalAmountMinor != null && withOrig.originalCurrency) {
      const major = (withOrig.originalAmountMinor / 100)
        .toFixed(2)
        .replace(".", ",");
      enrichedNote = `≈ ${major} ${withOrig.originalCurrency}`;
    }
  }

  return {
    mode: "native",
    amountMinor: native.amountMinor,
    currency: native.currency,
    accountInstitution: labels.institution,
    accountName: labels.name,
    annotationSv: enrichedNote,
    fx: null,
  };
}

export function isSupportedBankAppCurrency(
  value: string | null | undefined,
): value is CurrencyCode {
  return parseCurrencyToken(value) != null;
}
