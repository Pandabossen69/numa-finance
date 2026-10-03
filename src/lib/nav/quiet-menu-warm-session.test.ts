import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bundle: vi.fn(),
  analys: vi.fn(),
  mer: vi.fn(),
}));

vi.mock("@/lib/numa/read-client", () => ({
  readQuietMenuBundle: mocks.bundle,
  readAnalysSnapshot: mocks.analys,
  readMerSnapshot: mocks.mer,
}));

import { resetQuietMenuWarmForTests, scheduleQuietMenuWarm } from "./quiet-menu-warm";

const emptyBundle = {
  ok: true as const,
  data: {
    plan: null,
    gettingStarted: null,
    analys: null,
    movements: null,
    mer: null,
    accounts: null,
  },
};

describe("scheduleQuietMenuWarm session guard", () => {
  beforeEach(() => {
    resetQuietMenuWarmForTests();
    mocks.bundle.mockReset();
    mocks.analys.mockReset();
    mocks.mer.mockReset();
    mocks.bundle.mockResolvedValue(emptyBundle);
    mocks.analys.mockResolvedValue({ ok: false, error: "skip" });
    mocks.mer.mockResolvedValue({ ok: false, error: "skip" });
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: (fn: TimerHandler, ms?: number) => globalThis.setTimeout(fn, ms),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetQuietMenuWarmForTests();
  });

  it("warms once per session and restarts only with { restart: true }", async () => {
    scheduleQuietMenuWarm();
    scheduleQuietMenuWarm();
    await vi.runAllTimersAsync();
    expect(mocks.bundle).toHaveBeenCalledTimes(1);

    scheduleQuietMenuWarm();
    await vi.runAllTimersAsync();
    expect(mocks.bundle).toHaveBeenCalledTimes(1);

    scheduleQuietMenuWarm({ restart: true });
    await vi.runAllTimersAsync();
    expect(mocks.bundle).toHaveBeenCalledTimes(2);
  });
});
