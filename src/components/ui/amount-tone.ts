/**
 * Hugo: red is only for a negative balance or an amount strictly under 0.
 * Ordinary expense totals, labels and chips stay neutral.
 */
export function usesAlarmColor(amountMinor: number | null | undefined): boolean {
  return typeof amountMinor === "number" && amountMinor < 0;
}
