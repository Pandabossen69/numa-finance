import { afterEach, describe, expect, it } from "vitest";
import {
  LAST_KNOWN_STORAGE_KEY,
  clearPersistedLastKnown,
  readPersistedLastKnown,
  writePersistedLastKnown,
} from "./last-snapshot-persist";
import type { PersistedLastKnown } from "./last-snapshot-persist";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { LAST_HOME_COOKIE } from "./last-home-cookie";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
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

const home = {
  userId: "u1",
  displayName: "Hugo",
  remainingTodayMinor: 400_00,
} as HomeSnapshot;

function payload(partial: Partial<PersistedLastKnown> = {}): PersistedLastKnown {
  return {
    v: 1,
    userId: "u1",
    home,
    plan: null,
    analys: null,
    mer: null,
    accounts: null,
    movements: null,
    gettingStarted: null,
    planView: null,
    analysScope: null,
    movementsView: null,
    ...partial,
  };
}

describe("last-known persist", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "document");
  });

  it("round-trips Hem chrome so the next open can paint without RSC", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    mockDocumentCookie();
    writePersistedLastKnown(payload());
    const next = readPersistedLastKnown();
    expect(next?.userId).toBe("u1");
    expect(next?.home?.displayName).toBe("Hugo");
    expect(next?.home?.remainingTodayMinor).toBe(400_00);
    expect(document.cookie).toContain(LAST_HOME_COOKIE);
    clearPersistedLastKnown();
    expect(readPersistedLastKnown()).toBeNull();
    expect(globalThis.localStorage.getItem(LAST_KNOWN_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain(`${LAST_HOME_COOKIE}=`);
  });

  it("can clear persist and keep the slim last-home cookie (SPEC H)", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    mockDocumentCookie();
    writePersistedLastKnown(payload());
    expect(document.cookie).toContain(LAST_HOME_COOKIE);
    clearPersistedLastKnown({ keepHomeCookie: true });
    expect(readPersistedLastKnown()).toBeNull();
    expect(document.cookie).toContain(LAST_HOME_COOKIE);
    expect(document.cookie).toContain("400");
  });

  it("writes numa.lastHome.v1 even when localStorage is unavailable (SPEC 6b)", () => {
    mockDocumentCookie();
    // No localStorage — previous path returned before cookie write.
    writePersistedLastKnown(payload());
    expect(document.cookie).toContain(LAST_HOME_COOKIE);
    expect(document.cookie).toContain("400");
  });

  it("caps a long Rörelser list so persist cannot blow the quota", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    mockDocumentCookie();
    const items = Array.from({ length: 80 }, (_, i) => ({ id: `t${i}` }));
    writePersistedLastKnown(
      payload({
        movements: {
          currency: "THB",
          hasBankTruth: true,
          balanceMinor: 1,
          monthIncomeMinor: 0,
          monthExpenseMinor: 0,
          monthNetMinor: 0,
          allIncomeMinor: 0,
          allExpenseMinor: 0,
          allNetMinor: 0,
          monthCategories: [],
          items: items as never,
          timeZone: "Asia/Bangkok",
          monthKey: "2026-09",
        },
      }),
    );
    expect(readPersistedLastKnown()?.movements?.items).toHaveLength(50);
  });

  it("keeps Analys period dates and drops unused plan lists", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    mockDocumentCookie();
    writePersistedLastKnown(
      payload({
        analys: {
          currency: "THB",
          cycle: {
            startLabelSv: "1 sep.",
            endLabelSv: "1 okt.",
            incomes: [{ id: "i1" }],
            expenses: [{ id: "e1" }],
          },
          goals: [{ id: "g1" }],
          ledgerTransactions: [{ id: "t1" }],
        } as never,
      }),
    );
    const next = readPersistedLastKnown()?.analys;
    expect(next?.cycle.startLabelSv).toBe("1 sep.");
    expect(next?.cycle.endLabelSv).toBe("1 okt.");
    expect(next?.cycle.incomes).toEqual([]);
    expect(next?.cycle.expenses).toEqual([]);
    expect(next?.goals).toEqual([]);
    expect(next?.ledgerTransactions).toHaveLength(1);
  });
});

