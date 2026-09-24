import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = { id: string; storage_path: string | null };

const state = {
  rows: [] as Row[],
  calls: [] as string[],
  removed: [] as string[][],
  removeError: null as { message: string } | null,
  rpcArgs: null as Record<string, unknown> | null,
  cutoff: null as string | null,
};

function fakeClient() {
  return {
    from(table: string) {
      expect(table).toBe("source_observations");
      const q = {
        select: () => q,
        not: (col: string, op: string, val: unknown) => {
          expect([col, op, val]).toEqual(["storage_path", "is", null]);
          return q;
        },
        lte: (col: string, iso: string) => {
          expect(col).toBe("captured_at");
          state.cutoff = iso;
          return q;
        },
        order: () => q,
        range: async (from: number, to: number) => {
          state.calls.push(`list:${from}-${to}`);
          return { data: state.rows.slice(from, to + 1), error: null };
        },
      };
      return q;
    },
    storage: {
      from(bucket: string) {
        expect(bucket).toBe("numa-source-media");
        return {
          remove: async (paths: string[]) => {
            state.calls.push(`remove:${paths.length}`);
            state.removed.push(paths);
            return { data: [], error: state.removeError };
          },
        };
      },
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.calls.push(`rpc:${name}`);
      state.rpcArgs = args;
      return { data: { ok: true, purged: state.rows.length }, error: null };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceRoleClient: () => fakeClient(),
}));

const { purgeExpiredObservations, purgeCutoffIso } = await import(
  "./supabase-repository"
);

beforeEach(() => {
  state.rows = [];
  state.calls = [];
  state.removed = [];
  state.removeError = null;
  state.rpcArgs = null;
  state.cutoff = null;
});

const NOW = new Date("2026-09-24T03:00:00.000Z");

describe("purgeExpiredObservations (Supabase)", () => {
  it("deletes the Storage files before clearing storage_path", async () => {
    state.rows = [
      { id: "a", storage_path: "u1/a.jpg" },
      { id: "b", storage_path: "u2/b.jpg" },
    ];
    const result = await purgeExpiredObservations({ now: NOW });
    expect(state.removed).toEqual([["u1/a.jpg", "u2/b.jpg"]]);
    expect(state.calls.indexOf("remove:2")).toBeLessThan(
      state.calls.indexOf("rpc:purge_expired_source_images"),
    );
    expect(result).toEqual({ purged: 2, filesRemoved: 2 });
  });

  it("uses the same 30-day cutoff as the SQL function", async () => {
    await purgeExpiredObservations({ now: NOW });
    expect(state.cutoff).toBe("2026-08-25T03:00:00.000Z");
    expect(state.cutoff).toBe(purgeCutoffIso(NOW, 30));
    expect(state.rpcArgs).toEqual({
      p_now: NOW.toISOString(),
      p_retention_days: 30,
    });
  });

  it("pages the listing and removes files in chunks of 100", async () => {
    state.rows = Array.from({ length: 1_234 }, (_, i) => ({
      id: String(i).padStart(5, "0"),
      storage_path: `u/${i}.jpg`,
    }));
    const result = await purgeExpiredObservations({ now: NOW });
    expect(state.calls.filter((c) => c.startsWith("list:"))).toEqual([
      "list:0-499",
      "list:500-999",
      "list:1000-1499",
    ]);
    expect(state.removed).toHaveLength(13);
    expect(state.removed.flat()).toHaveLength(1_234);
    expect(result.filesRemoved).toBe(1_234);
  });

  it("does not clear the DB path when Storage removal fails", async () => {
    state.rows = [{ id: "a", storage_path: "u1/a.jpg" }];
    state.removeError = { message: "storage down" };
    await expect(purgeExpiredObservations({ now: NOW })).rejects.toThrow(
      "storage down",
    );
    expect(state.calls).not.toContain("rpc:purge_expired_source_images");
  });

  it("still runs the RPC when there is nothing to delete", async () => {
    const result = await purgeExpiredObservations({ now: NOW });
    expect(state.removed).toEqual([]);
    expect(state.calls).toContain("rpc:purge_expired_source_images");
    expect(result.filesRemoved).toBe(0);
  });
});
