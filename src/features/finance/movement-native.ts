import { CANONICAL_CURRENCY, thbToNativeMinor } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import type { MovementRow, MovementsSnapshot } from "@/features/finance/load-movements";

/**
 * Prefill Rörelser edit with the native booking. A stale client snapshot
 * can lose native fields after Hem/Plan adopt and copy THB into both
 * amountMinor and nativeAmountMinor — recover via the locked FX rate.
 */
export function movementEditPrefill(
  tx: Pick<
    MovementRow,
    | "amountMinor"
    | "currency"
    | "nativeAmountMinor"
    | "nativeCurrency"
    | "fxRate"
  >,
  accountCurrency?: CurrencyCode | null,
): { amountMinor: number; currency: CurrencyCode } {
  const nativeCurrency =
    (tx.nativeCurrency && tx.nativeCurrency !== tx.currency
      ? tx.nativeCurrency
      : null) ??
    (accountCurrency && accountCurrency !== tx.currency
      ? accountCurrency
      : null) ??
    tx.nativeCurrency ??
    tx.currency;

  const nativeLooksCopiedFromThb =
    tx.currency === CANONICAL_CURRENCY &&
    nativeCurrency !== CANONICAL_CURRENCY &&
    (tx.nativeAmountMinor == null ||
      tx.nativeAmountMinor === tx.amountMinor ||
      tx.nativeCurrency == null ||
      tx.nativeCurrency === CANONICAL_CURRENCY);

  if (nativeLooksCopiedFromThb && tx.fxRate) {
    try {
      return {
        amountMinor: thbToNativeMinor(
          tx.amountMinor,
          nativeCurrency,
          tx.fxRate,
        ),
        currency: nativeCurrency,
      };
    } catch {
      // Missing/invalid rate — fall through to the stored native.
    }
  }

  return {
    amountMinor: tx.nativeAmountMinor ?? tx.amountMinor,
    currency: nativeCurrency,
  };
}

/** Keep optimistic dirty rows, but never let them overwrite native booking. */
export function mergeMovementNativeFromServer(
  current: MovementsSnapshot,
  incoming: MovementsSnapshot,
): MovementsSnapshot {
  const incomingById = new Map(incoming.items.map((row) => [row.id, row]));
  return {
    ...current,
    items: current.items.map((item) => {
      const fresh = incomingById.get(item.id);
      if (!fresh) return item;
      return {
        ...item,
        nativeAmountMinor: fresh.nativeAmountMinor,
        nativeCurrency: fresh.nativeCurrency,
        fxRate: fresh.fxRate ?? item.fxRate,
        amountMinor: fresh.amountMinor,
        currency: fresh.currency,
      };
    }),
  };
}
