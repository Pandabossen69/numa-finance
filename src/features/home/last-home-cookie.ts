import type { HomeSnapshot } from "@/features/finance/load-home";

export const LAST_HOME_COOKIE = "numa.lastHome.v1";
const MAX_COOKIE_CHARS = 3_500;

/** Cap long Swedish labels so the cookie stays under browser limits. */
const LABEL_MAX = 48;

function clip(value: string | null | undefined, max = LABEL_MAX): string | null {
  if (value == null) return null;
  if (value.length <= max) return value;
  return value.slice(0, max);
}

/**
 * Slim Hem shell for `numa.lastHome.v1`.
 * Full HomeSnapshot + long verification/hint strings often exceed Max-Age
 * cookie size (encodeURIComponent > 3500) and made writeLastHomeCookie a
 * silent no-op — QA saw no cookie after real Hem (SPEC 6b).
 */
export function toLastHomeCookieShell(home: HomeSnapshot): HomeSnapshot {
  return {
    userId: home.userId,
    displayName: clip(home.displayName, 64) ?? "",
    timeZone: home.timeZone,
    primaryAccountId: home.primaryAccountId,
    currency: home.currency,
    monthKey: home.monthKey,
    monthLabelSv: clip(home.monthLabelSv, 32) ?? "",
    hasBankTruth: home.hasBankTruth,
    calculatedBalanceMinor: home.calculatedBalanceMinor,
    // Drop bulky prose — not needed to SSR Kvar/Över.
    verificationLabel: null,
    todaySpendingMinor: home.todaySpendingMinor,
    todayPlannedPaidMinor: home.todayPlannedPaidMinor,
    monthSpendingMinor: home.monthSpendingMinor,
    cycleSpendingMinor: home.cycleSpendingMinor,
    safeToSpendTodayMinor: home.safeToSpendTodayMinor,
    cycleStartLabelSv: clip(home.cycleStartLabelSv),
    cycleEndLabelSv: clip(home.cycleEndLabelSv),
    cycleEndInferred: home.cycleEndInferred,
    cycleIsActive: home.cycleIsActive,
    livingMode: home.livingMode,
    needsAvailableInput: home.needsAvailableInput,
    usesBankBalance: home.usesBankBalance,
    planIncomeMinor: home.planIncomeMinor,
    planExpenseMinor: home.planExpenseMinor,
    planSavingsMinor: home.planSavingsMinor,
    freeToSpendMinor: home.freeToSpendMinor,
    remainingFreeMinor: home.remainingFreeMinor,
    spendDaysLeft: home.spendDaysLeft,
    dayBudgetMinor: home.dayBudgetMinor,
    remainingTodayMinor: home.remainingTodayMinor,
    daysUntilIncome: home.daysUntilIncome,
    nextIncomeLabelSv: clip(home.nextIncomeLabelSv),
    extraSaldoMinor: home.extraSaldoMinor,
    extraSaldoDrawnMinor: home.extraSaldoDrawnMinor,
    extraSaldoHint: null,
    extraCarriedInMinor: home.extraCarriedInMinor,
    savingsTotalMinor: home.savingsTotalMinor,
    wealthTotalMinor: home.wealthTotalMinor,
    monthResultMinor: home.monthResultMinor,
    incomingMinor: home.incomingMinor,
    unpaidMinor: home.unpaidMinor,
    overMinor: home.overMinor,
    financeRevision: clip(home.financeRevision, 80) ?? "",
    verifiedAt: home.verifiedAt,
    truthStatus: home.truthStatus,
  };
}

export function parseLastHomeCookie(
  raw: string | undefined | null,
): HomeSnapshot | null {
  if (!raw) return null;
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const rec = parsed as Partial<HomeSnapshot>;
    if (typeof rec.userId !== "string" || rec.userId.length === 0) return null;
    if (typeof rec.currency !== "string") return null;
    if (typeof rec.remainingTodayMinor !== "number") return null;
    if (typeof rec.dayBudgetMinor !== "number") return null;
    return rec as HomeSnapshot;
  } catch {
    return null;
  }
}

export function serializeLastHomeCookie(home: HomeSnapshot): string | null {
  try {
    const shell = toLastHomeCookieShell(home);
    const encoded = encodeURIComponent(JSON.stringify(shell));
    if (encoded.length > MAX_COOKIE_CHARS) return null;
    return encoded;
  } catch {
    return null;
  }
}

/** True when the full snap would have exceeded the cookie cap (pre-slim). */
export function fullHomeSnapshotExceedsCookieCap(home: HomeSnapshot): boolean {
  try {
    return encodeURIComponent(JSON.stringify(home)).length > MAX_COOKIE_CHARS;
  } catch {
    return true;
  }
}

export function readLastHomeCookieFromDocument(): HomeSnapshot | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  const prefix = `${LAST_HOME_COOKIE}=`;
  const hit = parts.find((part) => part.startsWith(prefix));
  return parseLastHomeCookie(hit ? hit.slice(prefix.length) : null);
}

export function writeLastHomeCookie(home: HomeSnapshot | null): void {
  if (typeof document === "undefined") return;
  if (!home) {
    document.cookie = `${LAST_HOME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  const encoded = serializeLastHomeCookie(home);
  if (!encoded) return;
  document.cookie = `${LAST_HOME_COOKIE}=${encoded}; Path=/; Max-Age=2592000; SameSite=Lax`;
}
