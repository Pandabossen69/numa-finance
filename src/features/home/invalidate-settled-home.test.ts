import { afterEach, describe, expect, it } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { LAST_HOME_COOKIE } from "@/features/home/last-home-cookie";
import {
  LAST_KNOWN_STORAGE_KEY,
  readPersistedLastKnown,
  writePersistedLastKnown,
  type PersistedLastKnown,
} from "@/features/home/last-snapshot-persist";
import {
  invalidateSettledHomeSurfaces,
  resetSettledHomeEpochForTests,
  settledHomeEpoch,
} from "@/features/home/invalidate-settled-home";
import {
  planMonthPaintEpoch,
  resetPlanMonthCacheForTests,
} from "@/features/plan/plan-month-cache";

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
        const eq = pair?.indexOf("=") ?? -1;
        const name = eq >= 0 ? pair!.slice(0, eq) : "";
        const value = eq >= 0 ? pair!.slice(eq + 1) : "";
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

afterEach(() => {
  resetSettledHomeEpochForTests();
  resetPlanMonthCacheForTests();
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("invalidateSettledHomeSurfaces", () => {
  it("clears lastHome, drops the plan-month cache, and bumps the epoch", () => {
    mockDocumentCookie();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    resetPlanMonthCacheForTests();
    resetSettledHomeEpochForTests();
    const home = {
      userId: "u1",
      displayName: "Hugo",
      timeZone: "Asia/Bangkok",
      remainingTodayMinor: 400_00,
      calculatedBalanceMinor: 10_000_00,
    } as HomeSnapshot;
    const payload: PersistedLastKnown = {
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
    };
    writePersistedLastKnown(payload);
    expect(readPersistedLastKnown()?.home?.userId).toBe("u1");
    expect(document.cookie).toContain(LAST_HOME_COOKIE);
    const epochBefore = settledHomeEpoch();
    const paintBefore = planMonthPaintEpoch();

    const next = invalidateSettledHomeSurfaces();

    expect(next).toBe(epochBefore + 1);
    expect(settledHomeEpoch()).toBe(next);
    expect(readPersistedLastKnown()?.home).toBeNull();
    expect(localStorage.getItem(LAST_KNOWN_STORAGE_KEY)).toContain('"home":null');
    expect(document.cookie).not.toContain(`${LAST_HOME_COOKIE}=`);
    expect(planMonthPaintEpoch()).toBeGreaterThan(paintBefore);
  });
});
