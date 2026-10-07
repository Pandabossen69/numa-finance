/**
 * Copy only. Does not decide dagsbudget — Hem already hid the envelope
 * when there is nothing left to divide.
 */
export function unpaidBillsExceedSaldo(input: {
  hasSaldo: boolean;
  isEmpty: boolean;
  showDayEnvelope: boolean;
  unpaidMinor: number;
  balanceMinor: number | null;
}): boolean {
  if (!input.hasSaldo || input.isEmpty || input.showDayEnvelope) return false;
  if (input.balanceMinor == null) return false;
  return input.unpaidMinor > input.balanceMinor;
}

export const DAGSBUDGET_BILLS_EXCEED_SALDO_SV =
  "Obetalda räkningar före lönen är större än saldot. Flytta en räkning med Betala senare i Plan.";
