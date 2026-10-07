import {
  fundingMonthWindow,
  labelMonthNameSv,
  monthKeyFromDate,
  projectPayCycle,
  type PlanItem,
} from "@/domain/finance";

/**
 * Quiet caption for Analys → Månad.
 *
 * The month name is the salary month (funding wave), which can still be
 * September while the calendar month is October. The span is the live
 * pay-cycle window when the selected month is that open salary month, and
 * also when the selected month is the current calendar month but the live
 * cycle still belongs to an earlier pay month. Otherwise the span is the
 * browsed month's own funding window.
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
  const calendarMonthKey = monthKeyFromDate(now, input.timeZone);
  if (
    input.monthKey === calendarMonthKey &&
    live.fundingMonthKey != null &&
    live.fundingMonthKey < input.monthKey &&
    live.startLabelSv &&
    live.endLabelSv
  ) {
    return caption(live.fundingMonthKey, live.startLabelSv, live.endLabelSv);
  }

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
