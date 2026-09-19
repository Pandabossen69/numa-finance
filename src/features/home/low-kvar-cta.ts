import { SV } from "@/features/copy/labels-sv";

/**
 * Hem next-action when Kvar is low. Display-only — never changes remainingToday
 * or any ledger formula. Threshold is "under ~20% of dagsbudget, or ≤ 0".
 */
export const LOW_KVAR_NUMERATOR = 1;
export const LOW_KVAR_DENOMINATOR = 5;

export type LowKvarCtaKind = "expense" | "plan";

export type LowKvarCta = {
  kind: LowKvarCtaKind;
  href: string;
  label: string;
  hint: string;
};

export type LowKvarCtaInput = {
  dayBudgetMinor: number;
  remainingTodayMinor: number;
  livingMode: "bridge" | "cycle" | "empty";
  needsAvailableInput: boolean;
  hasPrimaryAccount: boolean;
};

/** True when Kvar ≤ 0 or strictly under 20% of today's sticky dagsbudget. */
export function isLowKvarToday(
  remainingTodayMinor: number,
  dayBudgetMinor: number,
): boolean {
  if (dayBudgetMinor <= 0) return false;
  if (remainingTodayMinor <= 0) return true;
  return remainingTodayMinor * LOW_KVAR_DENOMINATOR < dayBudgetMinor * LOW_KVAR_NUMERATOR;
}

/**
 * Primary Hem CTA when Kvar is tight.
 * - Low but still some left + a konto → «Lägg utgift» (jump to QuickExpense)
 * - Kvar ≤ 0, or no konto to log against → «Öppna Plan»
 * Other Hem owners (empty / saldo-input / no dagsbudget) keep their own CTAs.
 */
export function lowKvarNextAction(input: LowKvarCtaInput): LowKvarCta | null {
  if (input.needsAvailableInput) return null;
  if (input.livingMode === "empty") return null;
  if (!isLowKvarToday(input.remainingTodayMinor, input.dayBudgetMinor)) {
    return null;
  }

  if (input.remainingTodayMinor > 0 && input.hasPrimaryAccount) {
    return {
      kind: "expense",
      href: "#lagg-utgift",
      label: SV.laggUtgift,
      hint: SV.laggUtgiftHintLowKvar,
    };
  }

  return {
    kind: "plan",
    href: "/plan",
    label: SV.oppnaPlan,
    hint: SV.oppnaPlanHintLowKvar,
  };
}
