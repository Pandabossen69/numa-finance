import type { CurrencyCode } from "@/domain/money";
import type { FxCheckpoint } from "./canonical-thb";

export type LockedFx = {
  thbMinor: number;
  fxRate: number;
  fxAsOf: string;
  fxSource: string;
};

/**
 * Lock native → THB at write time. Same convention as saldo:
 * `thb = round(nativeMinor * fxRate)`.
 *
 * Returns null when a non-THB amount has no usable rate — never invent ฿0.
 */
export function lockFxAtWrite(input: {
  nativeMinor: number;
  currency: CurrencyCode;
  checkpoint?: Pick<FxCheckpoint, "fxRate"> | null;
  nowIso?: string;
  fxSource?: string;
}): LockedFx | null {
  const asOf = input.nowIso ?? new Date().toISOString();
  if (input.currency === "THB") {
    return {
      thbMinor: input.nativeMinor,
      fxRate: 1,
      fxAsOf: asOf,
      fxSource: input.fxSource ?? "identity",
    };
  }
  const rate = input.checkpoint?.fxRate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return {
    thbMinor: Math.round(input.nativeMinor * rate),
    fxRate: rate,
    fxAsOf: asOf,
    fxSource: input.fxSource ?? "transaction",
  };
}

/** Inverse of `round(native * rate)` for writing a THB plan amount onto a foreign account. */
export function thbToNativeMinor(
  thbMinor: number,
  currency: CurrencyCode,
  fxRate: number | null | undefined,
): number {
  if (currency === "THB") return thbMinor;
  if (typeof fxRate !== "number" || !Number.isFinite(fxRate) || fxRate <= 0) {
    throw new Error("Konto saknar växelkurs");
  }
  return Math.round(thbMinor / fxRate);
}

export function nativeToThbMinor(
  nativeMinor: number,
  currency: CurrencyCode,
  fxRate: number | null | undefined,
): number | null {
  if (currency === "THB") return nativeMinor;
  if (typeof fxRate !== "number" || !Number.isFinite(fxRate) || fxRate <= 0) {
    return null;
  }
  return Math.round(nativeMinor * fxRate);
}

export function newClientMutationId(): string {
  return crypto.randomUUID();
}
