import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { knownList } from "@/features/numa/known-list";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("knownList", () => {
  it("keeps unknown distinct from an empty server list", () => {
    expect(knownList(null)).toBeNull();
    expect(knownList(undefined)).toBeNull();
    expect(knownList([])).toEqual([]);
    expect(knownList(["rad"])).toEqual(["rad"]);
  });
});

describe("unknown is not rendered as empty", () => {
  it("Rörelser stays on the skeleton until a snapshot exists", () => {
    const src = read("../../components/movements/MovementsScreen.tsx");
    expect(src).toContain("const view = stored ?? data ?? null");
    expect(src).toContain("if (!error) return <MovementsViewLoading />");
    expect(src).not.toContain("pendingMovementsShell");
    expect(src).not.toContain("monthIncomeMinor: 0");
    const emptyAt = src.indexOf("Inga rörelser här ännu.");
    const viewAt = src.indexOf("const view = stored ?? data ?? null");
    expect(viewAt).toBeGreaterThan(-1);
    expect(emptyAt).toBeGreaterThan(viewAt);
  });

  it("Plan does not invent an empty ledger before the snapshot", () => {
    const src = read("../../components/plan/PlanScreen.tsx");
    expect(src).toContain("if (!payload && !error)");
    expect(src).toContain("PlanViewLoading");
    expect(src).toContain("knownList(payload.items)");
    expect(src).not.toContain("payload?.items ?? []");
    expect(src).not.toContain("ledgerTransactions={payload?.ledgerTransactions ?? []}");
  });

  it("Hem cue stays hidden while the pending count is unknown", () => {
    const src = read("../../components/home/BankMailHemCue.tsx");
    expect(src).toContain("publishedCount == null");
    expect(src).not.toContain("pendingBankMailCountAction");
    expect(src).not.toContain("publishedCount ?? 0");
  });

  it("Analys does not call an empty ledger settled before the fetch", () => {
    const src = read("../../components/analys/AnalysDashboard.tsx");
    expect(src).toContain("ledgerSettled");
    expect(src).toContain("analysLedgerKnown");
    expect(src).toContain("serverAnalysLedgerUnknown");
    const recent = src.slice(src.indexOf("recent.length === 0"));
    expect(recent).toContain("ledgerSettled ?");
    expect(recent).toContain("recentEmptyLabel");
  });

  it("cold reads are GET and the home response carries the mail count", () => {
    const route = read("../../app/api/numa/read/route.ts");
    const hem = read("../../components/home/HemRouteClient.tsx");
    const importera = read("../../components/mer/ImporteraRouteClient.tsx");
    expect(route).toContain('Cache-Control": "no-store"');
    expect(route).toContain("getAuthUser");
    expect(route).not.toContain("searchParams.get(\"user");
    expect(route).toContain("countPendingBankMail");
    expect(route).toContain("loadHomeSnapshot()");
    expect(route).toContain("Promise.all");
    expect(hem).toContain("readHomeSnapshot");
    expect(hem).toContain("result.pendingBankMailCount");
    expect(hem).not.toContain("getHomeSnapshotAction");
    expect(importera).toContain("readImporteraRows");
    expect(importera).not.toContain("loadImporteraRowsAction");
    expect(read("../../components/movements/MovementsRouteClient.tsx")).toContain(
      "readMovementsSnapshot",
    );
    expect(read("../../components/plan/PlanRouteClient.tsx")).toContain(
      "readPlanPageData",
    );
  });
});
