import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { LAST_HOME_COOKIE, serializeLastHomeCookie } from "./last-home-cookie";

const getSessionUser = vi.fn();
const cookieGet = vi.fn();
const cookieDelete = vi.fn();
const loadHomeSnapshot = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: cookieGet,
    delete: cookieDelete,
  }),
}));

vi.mock("@/features/auth/session", () => ({
  getSessionUser: () => getSessionUser(),
}));

vi.mock("@/features/finance/load-home", () => ({
  loadHomeSnapshot: () => loadHomeSnapshot(),
}));

function home(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    userId: "u1",
    displayName: "Hugo",
    timeZone: "Asia/Bangkok",
    primaryAccountId: "acc",
    currency: "THB",
    monthKey: "2026-09",
    monthLabelSv: "september",
    hasBankTruth: true,
    calculatedBalanceMinor: 12_000_00,
    verificationLabel: null,
    todaySpendingMinor: 200_00,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: 1_000_00,
    cycleSpendingMinor: 400_00,
    safeToSpendTodayMinor: 800_00,
    cycleStartLabelSv: null,
    cycleEndLabelSv: null,
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: true,
    planIncomeMinor: 20_000_00,
    planExpenseMinor: 8_000_00,
    planSavingsMinor: 0,
    freeToSpendMinor: 12_000_00,
    remainingFreeMinor: 11_000_00,
    spendDaysLeft: 10,
    dayBudgetMinor: 1_000_00,
    remainingTodayMinor: 800_00,
    daysUntilIncome: 10,
    nextIncomeLabelSv: null,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 0,
    wealthTotalMinor: 12_000_00,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: 0,
    overMinor: 12_000_00,
    financeRevision: "r1",
    verifiedAt: "2026-09-08T08:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

describe("readLastHomeCookie session bind", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    cookieGet.mockReset();
    cookieDelete.mockReset();
    loadHomeSnapshot.mockReset();
  });

  it("same user gets the fast SSR shell", async () => {
    const { readLastHomeCookie } = await import("./last-home-cookie.server");
    const snap = home({ remainingTodayMinor: 640_00, overMinor: 5_420_00 });
    cookieGet.mockReturnValue({ value: serializeLastHomeCookie(snap) });
    getSessionUser.mockResolvedValue({
      id: "u1",
      email: "hugo@example.com",
    });

    const next = await readLastHomeCookie();
    expect(next?.userId).toBe("u1");
    expect(next?.displayName).toBe("Hugo");
    expect(next?.remainingTodayMinor).toBe(640_00);
    expect(next?.overMinor).toBe(5_420_00);
    expect(getSessionUser).toHaveBeenCalledTimes(1);
    expect(cookieDelete).not.toHaveBeenCalled();
  });

  it("another user gets no cached displayName or money", async () => {
    const { readLastHomeCookie } = await import("./last-home-cookie.server");
    cookieGet.mockReturnValue({
      value: serializeLastHomeCookie(
        home({ remainingTodayMinor: 640_00, overMinor: 5_420_00 }),
      ),
    });
    getSessionUser.mockResolvedValue({
      id: "u2",
      email: "other@example.com",
    });

    await expect(readLastHomeCookie()).resolves.toBeNull();
  });

  it("missing or expired session shows no financial shell", async () => {
    const { readLastHomeCookie } = await import("./last-home-cookie.server");
    cookieGet.mockReturnValue({
      value: serializeLastHomeCookie(home()),
    });
    getSessionUser.mockResolvedValue(null);

    await expect(readLastHomeCookie()).resolves.toBeNull();
  });

  it("clears the Hem cookie on logout", async () => {
    const { clearLastHomeCookie } = await import("./last-home-cookie.server");
    await clearLastHomeCookie();
    expect(cookieDelete).toHaveBeenCalledWith(LAST_HOME_COOKIE);
  });

  it("keeps the same-user cookie on login and drops another user's", async () => {
    const { discardLastHomeCookieIfNotUser } = await import(
      "./last-home-cookie.server"
    );
    cookieGet.mockReturnValue({
      value: serializeLastHomeCookie(home()),
    });
    await discardLastHomeCookieIfNotUser("u1");
    expect(cookieDelete).not.toHaveBeenCalled();

    await discardLastHomeCookieIfNotUser("u2");
    expect(cookieDelete).toHaveBeenCalledWith(LAST_HOME_COOKIE);
  });
});

describe("resolveHomeShell SPEC 6d", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    cookieGet.mockReset();
    cookieDelete.mockReset();
    loadHomeSnapshot.mockReset();
    vi.resetModules();
  });

  it("prefers the session-bound cookie and skips the live fetch (warm)", async () => {
    const { resolveHomeShell } = await import("./last-home-cookie.server");
    const snap = home({ remainingTodayMinor: 640_00, overMinor: 5_420_00 });
    cookieGet.mockReturnValue({ value: serializeLastHomeCookie(snap) });
    getSessionUser.mockResolvedValue({
      id: "u1",
      email: "hugo@example.com",
    });

    const next = await resolveHomeShell();
    expect(next?.remainingTodayMinor).toBe(640_00);
    expect(next?.overMinor).toBe(5_420_00);
    expect(loadHomeSnapshot).not.toHaveBeenCalled();
  });

  it("loads a live slim shell when authenticated with no cookie (cold)", async () => {
    const { resolveHomeShell } = await import("./last-home-cookie.server");
    cookieGet.mockReturnValue(undefined);
    getSessionUser.mockResolvedValue({
      id: "u1",
      email: "hugo@example.com",
    });
    loadHomeSnapshot.mockResolvedValue({
      ok: true,
      data: home({
        remainingTodayMinor: 777_00,
        overMinor: 9_001_00,
        verificationLabel: "long label that should be stripped from shell",
        extraSaldoHint: "hint prose",
      }),
    });

    const next = await resolveHomeShell();
    expect(next?.userId).toBe("u1");
    expect(next?.remainingTodayMinor).toBe(777_00);
    expect(next?.overMinor).toBe(9_001_00);
    expect(next?.verificationLabel).toBeNull();
    expect(next?.extraSaldoHint).toBeNull();
    expect(loadHomeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not fetch money without a session", async () => {
    const { resolveHomeShell } = await import("./last-home-cookie.server");
    cookieGet.mockReturnValue(undefined);
    getSessionUser.mockResolvedValue(null);

    await expect(resolveHomeShell()).resolves.toBeNull();
    expect(loadHomeSnapshot).not.toHaveBeenCalled();
  });

  it("fail-closes when the live snapshot belongs to another user", async () => {
    const { resolveHomeShell } = await import("./last-home-cookie.server");
    cookieGet.mockReturnValue(undefined);
    getSessionUser.mockResolvedValue({
      id: "u1",
      email: "hugo@example.com",
    });
    loadHomeSnapshot.mockResolvedValue({
      ok: true,
      data: home({ userId: "u2", remainingTodayMinor: 100_00 }),
    });

    await expect(resolveHomeShell()).resolves.toBeNull();
  });

  it("fail-softs when the live snapshot loader errors", async () => {
    const { resolveHomeShell } = await import("./last-home-cookie.server");
    cookieGet.mockReturnValue(undefined);
    getSessionUser.mockResolvedValue({
      id: "u1",
      email: "hugo@example.com",
    });
    loadHomeSnapshot.mockResolvedValue({
      ok: false,
      error: "Kunde inte hämta din ekonomi",
    });

    await expect(resolveHomeShell()).resolves.toBeNull();
  });
});
