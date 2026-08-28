import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const remote = readFileSync(
  new URL("./supabase-repository.ts", import.meta.url),
  "utf8",
);

describe("listTransactions pagination", () => {
  it("pages past PostgREST max_rows instead of silently dropping the tail", () => {
    expect(remote).toContain("LEDGER_PAGE_SIZE = 1000");
    expect(remote).toContain(".range(");
    expect(remote).toContain("from + LEDGER_PAGE_SIZE - 1");
    expect(remote).toContain("page.length < LEDGER_PAGE_SIZE");
  });

  it("keeps an explicit limit as a single request", () => {
    expect(remote).toContain("if (options?.limit != null)");
    expect(remote).toContain("ledgerQuery().limit(options.limit)");
  });
});
