import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MENU_SNAPSHOT_UNUSED_TABLES,
} from "@/lib/store/menu-snapshot-fetch";
import { NUMA_MENU_SNAPSHOT_TAG } from "@/lib/supabase/cache-tags";
import {
  ACCOUNT_SELECT,
  CHECKPOINT_SELECT,
  LEDGER_TRANSACTION_SELECT,
  PLAN_ITEM_SELECT,
  PROFILE_SELECT,
} from "@/lib/supabase/selects";

const home = readFileSync(new URL("./load-home.ts", import.meta.url), "utf8");
const plan = readFileSync(new URL("./load-plan.ts", import.meta.url), "utf8");
const analys = readFileSync(new URL("./load-analys.ts", import.meta.url), "utf8");
const movements = readFileSync(
  new URL("./load-movements.ts", import.meta.url),
  "utf8",
);
const repo = readFileSync(
  new URL("../../lib/store/supabase-repository.ts", import.meta.url),
  "utf8",
);
const repository = readFileSync(
  new URL("../../lib/store/repository.ts", import.meta.url),
  "utf8",
);
const planPage = readFileSync(
  new URL("../../app/(main)/plan/page.tsx", import.meta.url),
  "utf8",
);

describe("Hem / Plan / Analys loader contract", () => {
  it("shares one React-cached snapshot and never waits on gamification tables", () => {
    expect(NUMA_MENU_SNAPSHOT_TAG).toBe("numa-menu-snapshot");
    expect(home).toContain("export const getCachedTodaySnapshot = cache(");
    expect(plan).toContain("getCachedTodaySnapshot");
    expect(analys).toContain("getCachedTodaySnapshot");
    expect(movements).not.toContain("getCachedTodaySnapshot");

    for (const table of MENU_SNAPSHOT_UNUSED_TABLES) {
      expect(home).not.toContain(table);
      expect(plan).not.toContain(table);
      expect(analys).not.toContain(table);
      expect(movements).not.toContain(table);
    }
    expect(home).not.toContain("getUserProgress");
    expect(plan).not.toContain("getUserProgress");
    expect(analys).not.toContain("getUserProgress");
  });

  it("lets Rörelser fetch its own ledger instead of the Hem snapshot", () => {
    expect(movements).toContain("listTransactions(");
    expect(movements).not.toContain("snap.ledgerTransactions");
    expect(movements).not.toMatch(/from ["']@\/features\/finance\/load-home["']/);
  });

  it("lets Plan load its snapshot without a serial getting-started waterfall", () => {
    expect(planPage).toContain("loadPlanSnapshot");
    expect(planPage).toContain("Promise.all");
    expect(planPage).toContain("loadGettingStartedView");
  });
});

describe("menu snapshot repository contract", () => {
  it("builds the snapshot through the parallel bundle and skips progress on the read path", () => {
    const snapshotFn = repo.slice(
      repo.indexOf("export const getTodaySnapshot"),
      repo.indexOf("export async function getUserProgress"),
    );
    expect(snapshotFn).toContain("fetchMenuSnapshotBundle");
    expect(snapshotFn).not.toContain("getUserProgress");
    expect(repository).not.toContain("await api().getProfile()");
  });

  it("projects only the columns the menu mappers need", () => {
    expect(PROFILE_SELECT).not.toContain("*");
    expect(ACCOUNT_SELECT).not.toContain("*");
    expect(PLAN_ITEM_SELECT).not.toContain("*");
    expect(CHECKPOINT_SELECT).not.toContain("*");
    expect(LEDGER_TRANSACTION_SELECT).not.toContain("*");
    expect(LEDGER_TRANSACTION_SELECT).toContain("plan_item_id");
    expect(repo).toContain("PROFILE_SELECT");
    expect(repo).toContain("LEDGER_TRANSACTION_SELECT");
  });
});
