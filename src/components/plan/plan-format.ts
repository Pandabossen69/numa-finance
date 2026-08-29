import {
  formatListDateSv,
  nextCommittedCalendarDate,
} from "@/domain/finance";
import { parseUiAmountToMinor } from "@/domain/money";

export function minorToUi(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
}

export function formatPlanFigure(amountMinor: number): string {
  const hasFraction = Math.abs(amountMinor) % 100 !== 0;
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(amountMinor / 100);
}

export function labelIncomeDateSv(iso: string | null, timeZone: string): string {
  if (!iso) return "Datum saknas";
  return formatListDateSv(iso, timeZone);
}

export function commitCalendarDate(
  raw: string,
  current: string,
  onChange: (value: string) => void,
) {
  const next = nextCommittedCalendarDate(raw, current);
  if (next) onChange(next);
}

export function parsePlanAmount(raw: string): number | { error: string } {
  try {
    const amountMinor = parseUiAmountToMinor(raw);
    if (amountMinor < 0) return { error: "Belopp kan inte vara negativt" };
    return amountMinor;
  } catch {
    return { error: "Ogiltigt belopp" };
  }
}
