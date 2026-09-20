import { afterEach, describe, expect, it } from "vitest";
import { LOAD_TIMEOUT_MESSAGE_SV } from "@/lib/async";
import {
  ANALYS_CLIENT_TIMEOUT_MS,
  analysPendingHasExpired,
  analysViewCanPaint,
  canAnalysAutoRetry,
  fetchAnalysSnapshotClient,
  lastAnalysFetchResult,
  markAnalysAutoRetryUsed,
  markAnalysPendingStarted,
  resetAnalysClientFetchForTests,
} from "./analys-client-fetch";

afterEach(() => {
  resetAnalysClientFetchForTests();
});

describe("fetchAnalysSnapshotClient", () => {
  it("fails soft in Swedish when the action never settles", async () => {
    expect(ANALYS_CLIENT_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
    const result = await fetchAnalysSnapshotClient(
      () => new Promise(() => {}),
      20,
    );
    expect(result).toEqual({
      ok: false,
      error: LOAD_TIMEOUT_MESSAGE_SV,
    });
    expect(lastAnalysFetchResult()).toEqual(result);
  });

  it("fails soft when the action thenable never calls then (prod Flight)", async () => {
    const hungThenable = {
      then() {
        // Next.js production action thenables can sit in startTransition
        // until the POST + RSC re-render finish. The client cap must not.
      },
    };
    const result = await fetchAnalysSnapshotClient(
      () => hungThenable as Promise<never>,
      20,
    );
    expect(result).toEqual({
      ok: false,
      error: LOAD_TIMEOUT_MESSAGE_SV,
    });
  });

  it("reuses one inflight so a remount cannot start a second hung action", async () => {
    let starts = 0;
    const load = () => {
      starts += 1;
      return new Promise<never>(() => {});
    };
    const first = fetchAnalysSnapshotClient(load, 30);
    const second = fetchAnalysSnapshotClient(load, 30);
    expect(second).toBe(first);
    await expect(first).resolves.toEqual({
      ok: false,
      error: LOAD_TIMEOUT_MESSAGE_SV,
    });
    expect(starts).toBe(1);
  });

  it("passes through a settled snapshot", async () => {
    const result = await fetchAnalysSnapshotClient(async () => ({
      ok: true,
      data: { monthKey: "2026-09" } as never,
    }));
    expect(result.ok).toBe(true);
    expect(lastAnalysFetchResult()).toEqual(result);
  });

  it("keeps a Swedish loader error without wrapping it", async () => {
    const result = await fetchAnalysSnapshotClient(async () => ({
      ok: false,
      error: "Du måste vara inloggad",
    }));
    expect(result).toEqual({ ok: false, error: "Du måste vara inloggad" });
  });
});

describe("analys pending clock", () => {
  it("survives remounts so Hämtar analysen… cannot reset forever", () => {
    const started = 1_000;
    markAnalysPendingStarted(started);
    expect(analysPendingHasExpired(started + 4_499)).toBe(false);
    expect(analysPendingHasExpired(started + 4_500)).toBe(true);
    markAnalysPendingStarted(started + 10_000);
    expect(analysPendingHasExpired(started + 4_500)).toBe(true);
  });

  it("does not treat a last-known without month fields as paint", () => {
    expect(analysViewCanPaint(null)).toBe(false);
    expect(
      analysViewCanPaint({
        currentMonthKey: "2026-09",
        month: null,
      } as never),
    ).toBe(false);
    expect(
      analysViewCanPaint({
        currentMonthKey: "2026-09",
        month: { key: "2026-09" },
      } as never),
    ).toBe(true);
  });
});

describe("analys auto-retry", () => {
  it("allows one automatic retry after fail-soft", () => {
    expect(canAnalysAutoRetry()).toBe(true);
    markAnalysAutoRetryUsed();
    expect(canAnalysAutoRetry()).toBe(false);
  });
});
