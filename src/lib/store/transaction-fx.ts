import { lockFxAtWrite, type CanonicalTransaction } from "@/domain/finance";
import type { BalanceCheckpoint } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

export function fxFieldsForWrite(input: {
  nativeMinor: number;
  currency: CurrencyCode;
  checkpoint: Pick<BalanceCheckpoint, "thbMinor" | "fxRate" | "balanceMinor"> | null;
  nowIso: string;
}): Pick<CanonicalTransaction, "thbMinor" | "fxRate" | "fxAsOf" | "fxSource"> {
  const locked = lockFxAtWrite({
    nativeMinor: input.nativeMinor,
    currency: input.currency,
    checkpoint: input.checkpoint,
    nowIso: input.nowIso,
  });
  if (!locked) {
    if (input.currency !== "THB") {
      throw new Error(
        "Konto saknar växelkurs. Verifiera saldot med en kurs innan du bokar i " +
          input.currency +
          ".",
      );
    }
    return {
      thbMinor: input.nativeMinor,
      fxRate: 1,
      fxAsOf: input.nowIso,
      fxSource: "identity",
    };
  }
  return locked;
}

export function recomputeThbFromLockedRate(input: {
  nativeMinor: number;
  currency: CurrencyCode;
  fxRate: number | null | undefined;
  nowIso: string;
}): Pick<CanonicalTransaction, "thbMinor" | "fxRate" | "fxAsOf" | "fxSource"> {
  return fxFieldsForWrite({
    nativeMinor: input.nativeMinor,
    currency: input.currency,
    checkpoint: {
      thbMinor: null,
      fxRate: input.fxRate ?? (input.currency === "THB" ? 1 : null),
      balanceMinor: 0,
    },
    nowIso: input.nowIso,
  });
}
