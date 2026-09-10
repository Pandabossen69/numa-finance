import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginRepairQuietWindow,
  clearNumaRuntimeCache,
  isRepairQuietWindowActive,
  lagaStartsIdle,
  navigateAfterRepair,
  nextLagaPhase,
  NUMA_REPAIR_QUIET_FLAG,
  NUMA_SW_KILL_FLAG,
  readLagaHostSnapshot,
  REPAIR_QUIET_MS,
  shouldAcceptRepairStart,
  shouldReloadOnControllerChange,
} from "./repair";

const src = readFileSync(new URL("./repair.ts", import.meta.url), "utf8");

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    api: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    },
  };
}

function installStorages() {
  const local = memoryStorage();
  const session = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: local.api,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: session.api,
  });
  return { local, session };
}

function installCaches(initial: string[] = []) {
  const store = new Set(initial);
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      keys: async () => [...store],
      delete: async (key: string) => store.delete(key),
    },
  });
  return store;
}

function cleanupBrowserGlobals() {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");
  Reflect.deleteProperty(globalThis, "caches");
  Reflect.deleteProperty(globalThis, "navigator");
  Reflect.deleteProperty(globalThis, "window");
}

afterEach(() => {
  cleanupBrowserGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("/laga repair flow", () => {
  it("never auto-starts clearing", () => {
    expect(lagaStartsIdle()).toBe(true);
    expect(nextLagaPhase("idle", "success")).toBe("idle");
    expect(nextLagaPhase("idle", "fail")).toBe("idle");
  });

  it("requires an explicit confirm before running", () => {
    expect(nextLagaPhase("idle", "ask")).toBe("confirm");
    expect(nextLagaPhase("confirm", "cancel")).toBe("idle");
    expect(nextLagaPhase("running", "success")).toBe("done");
    expect(nextLagaPhase("running", "fail")).toBe("error");
  });

  it("ignores repeated confirm / success events while already running or done", () => {
    expect(nextLagaPhase("confirm", "ask")).toBe("confirm");
    expect(nextLagaPhase("running", "ask")).toBe("running");
    expect(nextLagaPhase("running", "cancel")).toBe("running");
    expect(nextLagaPhase("done", "ask")).toBe("done");
    expect(nextLagaPhase("done", "success")).toBe("done");
  });

  it("clears caches without SKIP_WAITING or update() (avoids iOS reload race)", () => {
    expect(src).toContain("caches.delete");
    expect(src).toContain("beginRepairQuietWindow");
    expect(src).toContain("navigateAfterRepair");
    expect(src).toContain("location.assign");
    expect(src).not.toContain("SKIP_WAITING");
    expect(src).not.toContain("reg.update");
    expect(src).not.toMatch(/\b\w+\.unregister\s*\(/);
    expect(src).not.toContain("reloadRepairSuccessPage");
  });
});

describe("useSyncExternalStore host snapshot", () => {
  it("returns a referentially stable primitive (object snapshots loop forever)", () => {
    const a = readLagaHostSnapshot("localhost", false);
    const b = readLagaHostSnapshot("localhost", false);
    expect(a).toBeNull();
    expect(Object.is(a, b)).toBe(true);

    const host = "numa-finance-preview.vercel.app";
    const c = readLagaHostSnapshot(host, true);
    const d = readLagaHostSnapshot(host, true);
    expect(c).toBe(host);
    expect(Object.is(c, d)).toBe(true);
    expect(typeof c).toBe("string");
  });
});

describe("repeated click protection", () => {
  it("accepts the first start and rejects the second", () => {
    expect(shouldAcceptRepairStart(false)).toBe(true);
    expect(shouldAcceptRepairStart(true)).toBe(false);
  });
});

describe("controllerchange reload race", () => {
  it("reloads standalone apps that already had a controller (existing PWA path)", () => {
    expect(
      shouldReloadOnControllerChange({
        hadController: true,
        standalone: true,
        repairQuiet: false,
      }),
    ).toBe(true);
  });

  it("does not reload when there is no controller yet", () => {
    expect(
      shouldReloadOnControllerChange({
        hadController: false,
        standalone: true,
        repairQuiet: false,
      }),
    ).toBe(false);
  });

  it("does not reload browser tabs (banner path)", () => {
    expect(
      shouldReloadOnControllerChange({
        hadController: true,
        standalone: false,
        repairQuiet: false,
      }),
    ).toBe(false);
  });

  it("does not reload during repair quiet (waiting/new worker must not bounce /laga)", () => {
    expect(
      shouldReloadOnControllerChange({
        hadController: true,
        standalone: true,
        repairQuiet: true,
      }),
    ).toBe(false);
  });
});

describe("repair quiet window", () => {
  it("is inactive until begin, then expires after REPAIR_QUIET_MS", () => {
    const { session } = installStorages();
    const t0 = 1_700_000_000_000;
    expect(isRepairQuietWindowActive(t0)).toBe(false);

    beginRepairQuietWindow(t0);
    expect(session.map.get(NUMA_REPAIR_QUIET_FLAG)).toBe(String(t0));
    expect(isRepairQuietWindowActive(t0 + 1_000)).toBe(true);
    expect(isRepairQuietWindowActive(t0 + REPAIR_QUIET_MS)).toBe(true);
    expect(isRepairQuietWindowActive(t0 + REPAIR_QUIET_MS + 1)).toBe(false);
    expect(session.map.has(NUMA_REPAIR_QUIET_FLAG)).toBe(false);
  });
});

describe("clearNumaRuntimeCache", () => {
  it("wipes present Cache Storage, sets quiet, and never talks to a waiting worker", async () => {
    const { local, session } = installStorages();
    const store = installCaches(["numa-static-old", "other"]);
    const postMessage = vi.fn();
    const update = vi.fn(async () => {});
    const unregister = vi.fn(async () => true);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          getRegistrations: async () => [
            { update, waiting: { postMessage }, unregister },
          ],
        },
      },
    });

    await clearNumaRuntimeCache();

    expect([...store]).toEqual([]);
    expect(local.map.get(NUMA_SW_KILL_FLAG)).toBe("done");
    expect(session.map.get(NUMA_REPAIR_QUIET_FLAG)).toBeTruthy();
    expect(postMessage).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
  });

  it("succeeds with empty Cache Storage and no service worker controller", async () => {
    installStorages();
    const store = installCaches([]);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    await clearNumaRuntimeCache();

    expect([...store]).toEqual([]);
    expect(isRepairQuietWindowActive()).toBe(true);
  });

  it("succeeds when Cache Storage is missing entirely", async () => {
    installStorages();
    await clearNumaRuntimeCache();
    expect(isRepairQuietWindowActive()).toBe(true);
  });
});

describe("navigateAfterRepair", () => {
  it("assigns to /idag after a short settle and keeps the quiet window", () => {
    vi.useFakeTimers();
    const { session } = installStorages();
    const assign = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "http://localhost:3000",
          assign,
        },
        setTimeout: (
          fn: (...args: unknown[]) => void,
          ms?: number,
          ...args: unknown[]
        ) => globalThis.setTimeout(fn, ms, ...args),
      },
    });

    navigateAfterRepair("/idag");
    expect(session.map.get(NUMA_REPAIR_QUIET_FLAG)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(String(assign.mock.calls[0]?.[0])).toMatch(
      /^http:\/\/localhost:3000\/idag\?r=\d+$/,
    );
  });
});
