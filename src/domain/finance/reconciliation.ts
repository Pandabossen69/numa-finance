import { money, type Money } from "@/domain/money";
import type { ReconciliationState } from "./types";

export type ReconciliationAssessment = {
  state: ReconciliationState;
  expected: Money;
  observed: Money;
  difference: Money;
  /** Absolute difference for messaging. */
  absDifference: Money;
  swedishSummary: string;
};

export function assessReconciliation(params: {
  expectedBalanceMinor: number;
  observedBalanceMinor: number;
  currency: Money["currency"];
  hoursSinceVerification?: number | null;
  staleAfterHours?: number;
}): ReconciliationAssessment {
  const currency = params.currency;
  const expected = money(params.expectedBalanceMinor, currency);
  const observed = money(params.observedBalanceMinor, currency);
  const difference = money(
    params.observedBalanceMinor - params.expectedBalanceMinor,
    currency,
  );
  const absDifference = money(Math.abs(difference.amountMinor), currency);

  const staleAfter = params.staleAfterHours ?? 72;
  const hours = params.hoursSinceVerification;

  if (difference.amountMinor === 0) {
    if (hours != null && hours > staleAfter) {
      return {
        state: "stale_verification",
        expected,
        observed,
        difference,
        absDifference,
        swedishSummary: "Saldo i synk, men verifieringen börjar bli gammal",
      };
    }
    return {
      state: "reconciled",
      expected,
      observed,
      difference,
      absDifference,
      swedishSummary: "Saldo i synk",
    };
  }

  const missing = difference.amountMinor < 0;
  const swedishSummary = missing
    ? `Det saknas ${formatAbs(absDifference)}`
    : `Det finns ${formatAbs(absDifference)} mer än förväntat`;

  return {
    state: "discrepancy",
    expected,
    observed,
    difference,
    absDifference,
    swedishSummary,
  };
}

export function hoursSince(isoTimestamp: string, now = new Date()): number {
  const then = Date.parse(isoTimestamp);
  return (now.getTime() - then) / (1000 * 60 * 60);
}

function formatAbs(value: Money): string {
  const major = (value.amountMinor / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value.currency === "THB" ? `฿${major}` : `${major} kr`;
}
