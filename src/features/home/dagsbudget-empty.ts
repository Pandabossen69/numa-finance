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

export const PERIOD_ENDED_TITLE_SV = "Perioden är slut";

export const PERIOD_ENDED_BODY_SV =
  "Lägg in nästa inkomst i Plan så räknar vi ut din dagsbudget.";

export const PERIOD_ENDED_CTA_SV = "Lägg in inkomst";

/** Analys Lönemånad — date comes from the cycle, never a made-up amount. */
export function periodEndedOnSv(endLabel: string | null | undefined): string {
  const date = endLabel?.replace(/\.$/, "").trim();
  return date ? `Perioden avslutad ${date}` : "Perioden avslutad";
}
