import { afterEach, describe, expect, it } from "vitest";
import {
  LAST_KNOWN_STORAGE_KEY,
  clearPersistedLastKnown,
  readPersistedLastKnown,
  writePersistedLastKnown,
} from "./last-snapshot-persist";
import type { PersistedLastKnown } from "./last-snapshot-persist";
import type { HomeSnapshot } from "@/features/finance/load-home";

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
  });

  it("round-trips Hem chrome so the next open can paint without RSC", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    writePersistedLastKnown(payload());
    const next = readPersistedLastKnown();
    expect(next?.userId).toBe("u1");
    expect(next?.home?.displayName).toBe("Hugo");
    expect(next?.home?.remainingTodayMinor).toBe(400_00);
    clearPersistedLastKnown();
    expect(readPersistedLastKnown()).toBeNull();
    expect(globalThis.localStorage.getItem(LAST_KNOWN_STORAGE_KEY)).toBeNull();
  });

  it("caps a long Rörelser list so persist cannot blow the quota", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
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
});
