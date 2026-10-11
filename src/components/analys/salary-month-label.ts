import {
  fundingMonthWindow,
  labelMonthNameSv,
  projectPayCycle,
  type PlanItem,
} from "@/domain/finance";

/**
 * Quiet caption for Analys → Månad.
 *
 * The month name is the salary month (funding wave) for the month you are
 * looking at. The span is the live pay-cycle window when that month is the
 * open salary month. Otherwise it is the browsed month's own funding window.
 * The calendar month does not borrow an earlier salary caption — Månad
 * defaults to the live pay month instead, and October stays October.
 */
export function loneManadLabelSv(input: {
  monthKey: string;
  planItems: readonly PlanItem[];
  timeZone: string;
  now?: Date;
}): string | null {
  if (!input.monthKey || input.planItems.length === 0) return null;
  const now = input.now ?? new Date();
  const live = projectPayCycle([...input.planItems], now, input.timeZone);

  let startLabel = live.fundingMonthKey === input.monthKey ? live.startLabelSv : null;
  let endLabel = live.fundingMonthKey === input.monthKey ? live.endLabelSv : null;
  if (!startLabel || !endLabel) {
    const window = fundingMonthWindow(input.planItems, input.monthKey, input.timeZone);
    startLabel = window?.startLabelSv ?? null;
    endLabel = window?.endLabelSv ?? null;
  }
  if (!startLabel || !endLabel) return null;
  return caption(input.monthKey, startLabel, endLabel);
}

function caption(monthKey: string, startLabel: string, endLabel: string): string {
  const name = labelMonthNameSv(monthKey).toLocaleLowerCase("sv-SE");
  return `Lönemånad ${name} · ${startLabel} – ${endLabel}`;
}
