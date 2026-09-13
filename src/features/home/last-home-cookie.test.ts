import { afterEach, describe, expect, it } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  LAST_HOME_COOKIE,
  parseLastHomeCookie,
  serializeLastHomeCookie,
  writeLastHomeCookie,
} from "./last-home-cookie";

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

function mockDocumentCookie() {
  let jar = "";
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return jar;
      },
      set cookie(next: string) {
        const [pair] = next.split(";");
        const eq = pair.indexOf("=");
        const name = pair.slice(0, eq);
        const value = pair.slice(eq + 1);
        if (next.includes("Max-Age=0")) {
          jar = jar
            .split("; ")
            .filter((part) => part && !part.startsWith(`${name}=`))
            .join("; ");
          return;
        }
        const rest = jar
          .split("; ")
          .filter((part) => part && !part.startsWith(`${name}=`));
        rest.push(`${name}=${value}`);
        jar = rest.join("; ");
      },
    },
  });
}

describe("last-home cookie", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("round-trips Hem numbers for the first HTML", () => {
    const encoded = serializeLastHomeCookie(home());
    expect(encoded).toBeTruthy();
    const next = parseLastHomeCookie(encoded);
    expect(next?.remainingTodayMinor).toBe(800_00);
    expect(next?.dayBudgetMinor).toBe(1_000_00);
    expect(next?.displayName).toBe("Hugo");
  });

  it("rejects a cookie that cannot paint Hem numbers", () => {
    expect(parseLastHomeCookie("")).toBeNull();
    expect(parseLastHomeCookie("{")).toBeNull();
    expect(parseLastHomeCookie(JSON.stringify({ userId: "u1" }))).toBeNull();
  });

  it("writes Path=/ SameSite=Lax ~30d into document.cookie (SPEC 6b)", () => {
    mockDocumentCookie();
    let assigned = "";
    const desc = Object.getOwnPropertyDescriptor(globalThis, "document")!;
    const doc = desc.value as { cookie: string };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get cookie() {
          return doc.cookie;
        },
        set cookie(next: string) {
          assigned = next;
          doc.cookie = next;
        },
      },
    });
    writeLastHomeCookie(home({ remainingTodayMinor: 640_00 }));
    expect(assigned).toContain(`${LAST_HOME_COOKIE}=`);
    expect(assigned).toContain("Path=/");
    expect(assigned).toContain("SameSite=Lax");
    expect(assigned).toContain("Max-Age=2592000");
    expect(document.cookie).toContain(LAST_HOME_COOKIE);
  });
});
