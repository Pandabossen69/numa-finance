import type { Account, BalanceCheckpoint } from "@/domain/finance/types";
import { money, type Money } from "@/domain/money";

/**
 * Converts a native-currency balance to THB using the checkpoint's locked rate.
 * Rate convention: THB per 1 major unit of native currency
 * (same as Frankfurter / convertWithRate), so minor→minor is `round(balanceMinor * rate)`.
 *
 * Returns null when the balance cannot be expressed in THB — never invent ฿0.
 */
export function balanceToThbMinor(
  balanceMinor: number,
  currency: Account["currency"],
  checkpoint: Pick<BalanceCheckpoint, "thbMinor" | "fxRate" | "balanceMinor"> | null | undefined,
): number | null {
  if (currency === "THB") {
    return balanceMinor;
  }
  const rate = checkpoint?.fxRate;
  if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
    return Math.round(balanceMinor * rate);
  }
  // Exact checkpoint match without a usable rate — use locked THB if present.
  if (
    checkpoint &&
    typeof checkpoint.thbMinor === "number" &&
    checkpoint.balanceMinor === balanceMinor
  ) {
    return checkpoint.thbMinor;
  }
  return null;
}

export type AccountSaldoInput = {
  account: Account;
  /** Native calculated (or checkpoint) balance. Null = unknown for this account. */
  nativeMinor: number | null;
  checkpoint: BalanceCheckpoint | null;
};

/**
 * Σ of each account with known convertible saldo, expressed in THB.
 * Returns null when no account has a usable saldo (never fake ฿0).
 * Shared by Hem / Plan / Analys / Rörelser / Konton sum.
 */
export function totalSaldoThbMinor(inputs: AccountSaldoInput[]): number | null {
  let total = 0;
  let any = false;
  for (const { account, nativeMinor, checkpoint } of inputs) {
    if (nativeMinor == null || !checkpoint) continue;
    const thb = balanceToThbMinor(nativeMinor, account.currency, checkpoint);
    if (thb == null) continue;
    any = true;
    total += thb;
  }
  return any ? total : null;
}

export function totalSaldoAsMoney(inputs: AccountSaldoInput[]): Money | null {
  const minor = totalSaldoThbMinor(inputs);
  if (minor == null) return null;
  return money(minor, "THB");
}
