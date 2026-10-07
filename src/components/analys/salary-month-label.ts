import {
  fundingMonthWindow,
  labelMonthNameSv,
  projectPayCycle,
  type PlanItem,
} from "@/domain/finance";

/**
 * Quiet caption for Analys → Månad.
 *
 * The month name is the salary month (funding wave), which can still be
 * September on 6 October. The span is the live pay-cycle window when this
 * month is the open one, otherwise that month's own funding window.
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
  const name = labelMonthNameSv(input.monthKey).toLocaleLowerCase("sv-SE");
  return `Lönemånad ${name} · ${startLabel} – ${endLabel}`;
}
