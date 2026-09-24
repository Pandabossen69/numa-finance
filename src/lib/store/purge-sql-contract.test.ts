import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Storage deletion and numa_internal.purge_expired_source_images must select
 * the same rows. A broader listing deletes files the RPC leaves in place.
 */
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260904120000_p0_currency_alloc_mutations.sql",
    import.meta.url,
  ),
  "utf8",
);

const repository = readFileSync(
  new URL("./supabase-repository.ts", import.meta.url),
  "utf8",
);

describe("purge row contract", () => {
  it("SQL clears only storage_path is not null and captured_at <= cutoff", () => {
    const start = migration.indexOf("function numa_internal.purge_expired_source_images");
    const end = migration.indexOf(
      "create or replace function numa.purge_expired_source_images",
    );
    const fn = migration.slice(start, end);
    expect(fn).toContain(
      "v_cutoff timestamptz := p_now - make_interval(days => p_retention_days)",
    );
    const update = fn.slice(
      fn.indexOf("update numa.source_observations"),
      fn.indexOf("get diagnostics"),
    );
    expect(update.match(/\bwhere\b/g)).toEqual(["where"]);
    expect(update.replace(/\s+/g, " ")).toContain(
      "where storage_path is not null and captured_at <= v_cutoff;",
    );
    const where = update.slice(update.indexOf("where"));
    expect(where).not.toMatch(/user_id|\bstatus\b|\bkind\b|\bnotes\b/);
  });

  it("the Storage listing uses that cutoff and no extra row filter", () => {
    const start = repository.indexOf("export async function purgeExpiredObservations");
    const end = repository.indexOf("export async function setNextIncomeDate");
    const fn = repository.slice(start, end);
    expect(fn).toContain("observationPurgeCutoffIso(now, retentionDays)");
    const query = fn.slice(
      fn.indexOf('.from("source_observations")'),
      fn.indexOf(".order("),
    );
    expect(query.replace(/\s+/g, " ").trim()).toBe(
      '.from("source_observations") .select("id, storage_path") .not("storage_path", "is", null) .lte("captured_at", cutoffIso)',
    );
    expect(fn).toContain('rpc("purge_expired_source_images"');
  });
});
