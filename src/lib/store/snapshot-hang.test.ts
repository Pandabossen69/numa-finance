import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const idag = readFileSync(
  new URL("../../app/(main)/idag/page.tsx", import.meta.url),
  "utf8",
);
const analys = readFileSync(
  new URL("../../app/(main)/analys/page.tsx", import.meta.url),
  "utf8",
);
const dest = readFileSync(
  new URL("../../components/layout/dest-loading.tsx", import.meta.url),
  "utf8",
);
const viewLoading = readFileSync(
  new URL("../../components/layout/ViewLoading.tsx", import.meta.url),
  "utf8",
);

describe("cold Hem/Analys hang contract", () => {
  it("times out the whole snapshot including profile and accounts", () => {
    expect(repository).toContain("SNAPSHOT_TIMEOUT_MS = 3_000");
    const timed = repository.slice(
      repository.indexOf("export async function getTodaySnapshot"),
      repository.indexOf("export async function getLatestCheckpoint"),
    );
    expect(timed).toContain("loadTodaySnapshotOnce()");
    expect(timed).toMatch(/,\s*1\s*,?\s*\)/);
    const once = repository.slice(
      repository.indexOf("async function loadTodaySnapshotOnce"),
      repository.indexOf("export async function getTodaySnapshot"),
    );
    expect(once).toContain("api().getProfile()");
    expect(once).toContain("api().listAccounts()");
    expect(once).toContain("listPlanItems");
    expect(once).toContain("emptyTodaySnapshot(profile, accounts, null, planItems)");
  });

  it("does not keep Hem Suspense open on accounts or Kom igång", () => {
    expect(idag).toContain("loadHomeSnapshot");
    expect(idag).not.toContain("loadAccountsSnapshot");
    expect(idag).not.toContain("loadGettingStartedView");
    expect(idag).not.toContain("Promise.all");
  });

  it("paints last-known money or a short pending, never empty mint cards", () => {
    expect(idag).toContain("HemFirstPaint");
    expect(idag).not.toContain("readLastHomeCookie");
    expect(idag).not.toContain("HomeViewLoading");
    expect(analys).toContain("AnalysFirstPaint");
    expect(analys).not.toContain("AnalysViewLoading");
    expect(dest).toContain("HemFirstPaint");
    expect(dest).toContain("PlanFirstPaint");
    expect(dest).toContain("AnalysFirstPaint");
    expect(viewLoading).toContain("Hämtar läget…");
    expect(viewLoading).toContain("Hämtar planen…");
    expect(viewLoading).toContain("Hämtar analysen…");
    expect(viewLoading).toContain("remainingTodayMinor");
    const pending = viewLoading.slice(
      viewLoading.indexOf("export function AnalysPending"),
      viewLoading.indexOf("export function AnalysViewLoading"),
    );
    expect(pending).not.toContain("h-[10.5rem]");
    expect(pending).not.toContain("h-[22rem]");
  });
});
