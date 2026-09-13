import { afterEach, describe, expect, it } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  LAST_HOME_COOKIE,
  fullHomeSnapshotExceedsCookieCap,
  parseLastHomeCookie,
  serializeLastHomeCookie,
  toLastHomeCookieShell,
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

/** Real Hem-sized snap: long Swedish labels that blow the old full-JSON cap. */
function fatHome(): HomeSnapshot {
  return home({
    userId: "0de7a098-6be3-4ca0-af97-f9669f40cfe4",
    displayName: "Hugo Throsandher",
    primaryAccountId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1",
    calculatedBalanceMinor: 15_420_00,
    remainingTodayMinor: 771_00,
    dayBudgetMinor: 771_00,
    overMinor: 5_420_00,
    unpaidMinor: 10_000_00,
    verificationLabel:
      "Verifierat via manuellt saldo från Bangkok Bank (Checking ****6591) den 13 september 2026 kl. 16:38 Asia/Bangkok — avstämning mot senaste checkpoint och planposter för perioden. ".repeat(
        4,
      ),
    extraSaldoHint:
      "Extra saldo från förra perioden — används efter dagsbudgeten är slut. Inkluderar kvarvarande flexbuffert och överföringar mellan konton. ".repeat(
        4,
      ),
    cycleStartLabelSv:
      "25 augusti 2026 (start efter senaste lön, justerad för helg och förskott)",
    cycleEndLabelSv:
      "24 september 2026 (dagen före nästa lön enligt planposterna)",
    nextIncomeLabelSv:
      "Lön 3 oktober 2026 från arbetsgivaren (THB) — planpost kopplad till Bangkok Bank",
    financeRevision:
      "rev-2026-09-13T16:40:12.345Z-ledger-plan-accounts-fx-v3-with-extra-metadata-and-hash-" +
      "x".repeat(200),
  });
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

  it("slim-shells a fat Hem snap so the cookie is still written (SPEC 6b QA)", () => {
    const fat = fatHome();
    expect(fullHomeSnapshotExceedsCookieCap(fat)).toBe(true);

    // Old path: encodeURIComponent(JSON.stringify(full)) returned null.
    const fullEncoded = encodeURIComponent(JSON.stringify(fat));
    expect(fullEncoded.length).toBeGreaterThan(3_500);

    const encoded = serializeLastHomeCookie(fat);
    expect(encoded).toBeTruthy();
    expect(encoded!.length).toBeLessThanOrEqual(3_500);

    const next = parseLastHomeCookie(encoded);
    expect(next?.remainingTodayMinor).toBe(771_00);
    expect(next?.dayBudgetMinor).toBe(771_00);
    expect(next?.overMinor).toBe(5_420_00);
    expect(next?.calculatedBalanceMinor).toBe(15_420_00);
    expect(next?.todaySpendingMinor).toBe(200_00);
    expect(next?.userId).toBe(fat.userId);
    expect(next?.currency).toBe("THB");
    expect(next?.truthStatus).toBe("verified");
    // Bulky prose stripped from the shell.
    expect(next?.verificationLabel).toBeNull();
    expect(next?.extraSaldoHint).toBeNull();

    mockDocumentCookie();
    writeLastHomeCookie(fat);
    expect(document.cookie).toContain(LAST_HOME_COOKIE);
    expect(document.cookie).toContain("77100");
  });

  it("toLastHomeCookieShell keeps Kvar/Över paint fields", () => {
    const shell = toLastHomeCookieShell(fatHome());
    expect(shell.remainingTodayMinor).toBe(771_00);
    expect(shell.overMinor).toBe(5_420_00);
    expect(shell.verificationLabel).toBeNull();
    expect(encodeURIComponent(JSON.stringify(shell)).length).toBeLessThanOrEqual(
      3_500,
    );
  });
});
