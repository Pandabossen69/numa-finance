import type { CurrencyCode } from "@/domain/money";
import {
  fetchFxToThb,
  thbMinorFromNative,
} from "@/domain/money/fx";

export type CheckpointFxLock = {
  thbMinor: number;
  fxRate: number;
  fxAsOf: string;
  fxSource: string;
};

/**
 * Resolve the THB lock for a new checkpoint.
 * THB → identity. Otherwise prefer an explicit rate, then Frankfurter.
 * Throws if non-THB and no rate can be obtained (never invent).
 */
export async function resolveCheckpointFx(input: {
  currency: CurrencyCode;
  balanceMinor: number;
  fxRate?: number | null;
  fxAsOf?: string | null;
  fxSource?: string | null;
}): Promise<CheckpointFxLock> {
  if (input.currency === "THB") {
    return {
      thbMinor: input.balanceMinor,
      fxRate: 1,
      fxAsOf: input.fxAsOf ?? new Date().toISOString(),
      fxSource: input.fxSource ?? "identity",
    };
  }

  let rate = input.fxRate ?? null;
  let asOf = input.fxAsOf ?? null;
  let source = input.fxSource ?? null;

  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    const quote = await fetchFxToThb(input.currency);
    if (!quote) {
      throw new Error(
        "Kunde inte hämta växelkurs. Ange kurs manuellt (THB per 1 " +
          input.currency +
          ").",
      );
    }
    rate = quote.rate;
    asOf = quote.asOf;
    source = quote.source;
  }

  return {
    thbMinor: thbMinorFromNative(input.balanceMinor, input.currency, rate),
    fxRate: rate,
    fxAsOf: asOf ?? new Date().toISOString(),
    fxSource: source ?? "manual",
  };
}
