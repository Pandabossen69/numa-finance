import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), report: vi.fn() }));

vi.mock("@/lib/store/repository", () => ({
  refreshTodaySnapshot: mocks.refresh,
}));
vi.mock("@/lib/observe/report", () => ({ reportError: mocks.report }));
vi.mock("./snapshot-from-today", () => ({
  accountsSnapshotFromToday: () => ({}),
  homeSnapshotFromToday: () => ({}),
  movementsSnapshotFromToday: () => ({}),
  planSnapshotFromToday: () => ({}),
}));

import { refreshAfterDurableWrite } from "./mutation-refresh";

describe("refresh after committed money write", () => {
  beforeEach(() => vi.resetAllMocks());

  it("preserves saved status and invalidates stale pages when cleanup fails", async () => {
    const invalidate = vi.fn();
    const result = await refreshAfterDurableWrite(invalidate, async () => {
      throw new Error("cleanup unavailable");
    });
    expect(result).toEqual({ refreshPending: true });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("preserves saved status even if refresh and invalidation both fail", async () => {
    mocks.refresh.mockRejectedValue(new Error("offline"));
    expect(
      await refreshAfterDurableWrite(() => {
        throw new Error("cache offline");
      }),
    ).toEqual({ refreshPending: true });
  });

  it("refreshes after successful cleanup", async () => {
    const order: string[] = [];
    mocks.refresh.mockImplementation(async () => {
      order.push("read");
      return {};
    });
    const result = await refreshAfterDurableWrite(
      () => {
        order.push("invalidate");
      },
      async () => {
        order.push("cleanup");
      },
    );
    expect(result.refreshPending).toBe(false);
    expect(order).toEqual(["cleanup", "read", "invalidate"]);
  });
});
