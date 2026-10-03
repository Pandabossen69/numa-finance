import {
  APP_PLAN_START_MONTH,
  DEFAULT_TIMEZONE,
  monthKeyFromDate,
} from "@/domain/finance";

/** Shown when the mail is older than the account's ingående saldo. */
export const BANK_MAIL_BEFORE_OPENING_NOTICE = "påverkar inte saldot";

/** Shown when the mail is before Rörelser's first month. */
export const BANK_MAIL_BEFORE_PLAN_NOTICE = "syns inte i Rörelser";

/**
 * Date warnings for a pending bank-mail card. Nothing is booked here.
 * Saldo uses the opening checkpoint instant. Rörelser uses the Bangkok month.
 */
export function bankMailDateNotices(input: {
  occurredAt?: string | null;
  openingBalanceAt?: string | null;
  timeZone?: string;
  planStartMonth?: string;
}): string[] {
  const occurredMs = input.occurredAt ? Date.parse(input.occurredAt) : Number.NaN;
  if (!Number.isFinite(occurredMs)) return [];

  const notices: string[] = [];
  const openingMs = input.openingBalanceAt
    ? Date.parse(input.openingBalanceAt)
    : Number.NaN;
  if (Number.isFinite(openingMs) && occurredMs < openingMs) {
    notices.push(BANK_MAIL_BEFORE_OPENING_NOTICE);
  }

  const month = monthKeyFromDate(
    new Date(occurredMs),
    input.timeZone ?? DEFAULT_TIMEZONE,
  );
  const start = input.planStartMonth ?? APP_PLAN_START_MONTH;
  if (month < start) {
    notices.push(BANK_MAIL_BEFORE_PLAN_NOTICE);
  }
  return notices;
}

const BANK_MAIL_TOO_OLD_LEAD = "Mejlet är för gammalt för att bekräftas";

/**
 * Same sentence on the confirm card and from confirmBankMailAction.
 * Null means Bekräfta may book.
 */
export function bankMailConfirmBlockedMessage(input: {
  occurredAt?: string | null;
  openingBalanceAt?: string | null;
  timeZone?: string;
  planStartMonth?: string;
}): string | null {
  const notices = bankMailDateNotices(input);
  if (notices.length === 0) return null;
  const saldo = notices.includes(BANK_MAIL_BEFORE_OPENING_NOTICE);
  const rorelser = notices.includes(BANK_MAIL_BEFORE_PLAN_NOTICE);
  if (saldo && rorelser) {
    return `${BANK_MAIL_TOO_OLD_LEAD} – det påverkar inte saldot och syns inte i Rörelser.`;
  }
  if (saldo) {
    return `${BANK_MAIL_TOO_OLD_LEAD} – det påverkar inte saldot.`;
  }
  if (rorelser) {
    return `${BANK_MAIL_TOO_OLD_LEAD} – det syns inte i Rörelser.`;
  }
  return `${BANK_MAIL_TOO_OLD_LEAD}.`;
}
