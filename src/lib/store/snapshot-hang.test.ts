import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const idag = readFileSync(
  new URL("../../app/(main)/idag/page.tsx", import.meta.url),
  "utf8",
);
const hemClient = readFileSync(
  new URL("../../components/home/HemRouteClient.tsx", import.meta.url),
  "utf8",
);
const analys = readFileSync(
  new URL("../../app/(main)/analys/page.tsx", import.meta.url),
  "utf8",
);
const analysClient = readFileSync(
  new URL("../../components/analys/AnalysRouteClient.tsx", import.meta.url),
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
    expect(timed).toMatch(/,\s*0\s*,?\s*\)/);
    const once = repository.slice(
      repository.indexOf("async function loadTodaySnapshotOnce"),
      repository.indexOf("export async function getTodaySnapshot"),
    );
    expect(once).toContain("api().getProfile()");
    expect(once).toContain("api().listAccounts()");
  });

  it("does not keep Hem Suspense open on accounts or Kom igång", () => {
    expect(idag).toContain("HemRouteClient");
    expect(idag).not.toContain("loadAccountsSnapshot");
    expect(idag).not.toContain("loadGettingStartedView");
    expect(idag).not.toContain("Promise.all");
    expect(hemClient).toContain("fetchHomeSnapshot");
    expect(hemClient).not.toContain("loadAccountsSnapshot");
    expect(hemClient).not.toContain("loadGettingStartedView");
  });

  it("paints last-known money or a short pending, never empty mint cards", () => {
    expect(idag).toContain("HemRouteClient");
    expect(idag).not.toContain("readLastHomeCookie");
    expect(idag).not.toContain("HomeViewLoading");
    expect(hemClient).toContain("HemFirstPaint");
    expect(hemClient).toContain("lastSessionHomeSnapshot");
    expect(analys).toContain("AnalysRouteClient");
    expect(analys).not.toContain("AnalysViewLoading");
    expect(analysClient).toContain("lastAnalysSnapshot");
    expect(dest).toContain("HemFirstPaint");
    expect(dest).toContain("AnalysFirstPaint");
    expect(viewLoading).toContain("Hämtar läget…");
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
