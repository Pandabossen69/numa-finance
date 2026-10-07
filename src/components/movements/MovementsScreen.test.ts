import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./MovementsScreen.tsx", import.meta.url), "utf8");

describe("Rörelser expense color", () => {
  it("paints Utgifter neutral and negative Netto in clay alarm", () => {
    expect(src).toContain('label="Utgifter"');
    expect(src).toContain('tone="neutral"');
    expect(src).toContain('tone={net >= 0 ? "positive" : "alarm"}');
    expect(src).not.toMatch(/label="Utgifter"[\s\S]{0,120}tone="alarm"/);
    expect(src).not.toMatch(/label="Utgifter"[\s\S]{0,80}tone="danger"/);
  });

  it("blocks Spara and Ta bort while a mutation is in flight", () => {
    expect(src).toContain('useState<"save" | "void" | null>');
    expect(src).toContain("if (actionLock.current || pendingAction) return");
    expect(src).toContain("disabled={pendingAction != null}");
    expect(src).toContain('{pendingAction === "save" ? "Sparar…" : "Spara"}');
    expect(src).toContain('{pendingAction === "void" ? "Tar bort…" : "Ta bort"}');
  });

  it("paints row Ta bort and the confirm with the danger token", () => {
    const at = src.indexOf("setConfirmId(tx.id)");
    const row = src.slice(at - 180, at + 160);
    expect(row).toContain("text-[var(--numa-danger)]");
    expect(row).toMatch(/>\s*Ta bort\s*</);
    expect(row).not.toContain("text-[var(--numa-muted)]");
    expect(src).toContain(
      'className="numa-press numa-tap px-1 text-xs font-semibold text-[var(--numa-danger)]"',
    );
  });

  it("asks for an in-DOM confirm before Ta bort", () => {
    expect(src).toContain("confirmId");
    expect(src).toContain("setConfirmId(tx.id)");
    expect(src).not.toContain("window.confirm");
    expect(src).toContain('event.key === "Escape"');
    expect(src).toContain("confirmId == null || confirmId === tx.id");
  });

  it("formats edit amounts with a Swedish comma", () => {
    expect(src).toContain("minorToUiAmount");
    expect(src).not.toContain("toFixed(2)");
  });

  it("prefills native amount even when the dirty snapshot copied THB", () => {
    expect(src).toContain("movementEditPrefill");
    expect(src).toContain("mergeMovementNativeFromServer");
    expect(src).toContain("if (data === lastMovementsSnapshot()) return;");
    expect(src).toContain("@/features/finance/movement-native");
    expect(src).toContain("lastAccountsSnapshot");
    expect(src).toMatch(
      /import type \{ MovementsSnapshot \} from ["']@\/features\/finance\/load-movements["']/,
    );
    expect(src).not.toContain("minorToUi(tx.nativeAmountMinor ?? tx.amountMinor)");
  });

  it("gives Rörelser chips a 44px tap target", () => {
    expect(src).toContain("min-h-11 rounded-full");
    expect(src).not.toContain("min-h-10 rounded-full");
  });

  it("pluralizes the filtered count correctly", () => {
    expect(src).toContain('filtered.length === 1 ? "rörelse" : "rörelser"');
    expect(src).not.toContain("{filtered.length} rörelser");
  });

  it("makes Per kategori rows tap targets that filter the list", () => {
    expect(src).toContain("movementVisibleInRorelser");
    expect(src).toContain("toggleCategory");
    expect(src).toContain("spendCategoryName");
    expect(src).toContain("aria-pressed={selected}");
    expect(src).toContain("`Visa ${cat.name}`");
    expect(src).toContain("Visa alla kategorier");
    expect(src).toContain("Tryck på en kategori för att filtrera listan.");
    expect(src).toContain("Tryck igen för att visa alla.");
    expect(src).toContain("is-active bg-[var(--numa-bg)] ring-2 ring-[var(--numa-ink)]");
    expect(src).toContain("numa-category-chip");
    expect(src).toContain("selectCategory(spendCategoryName(tx.category))");
    expect(src).toContain("rememberMovementsView({");
    expect(src).toContain("cycleStartAt");
    expect(src).toContain("cycleEndAt");
    expect(src).toContain("payCycleRangeLabelSv");
    expect(src).toContain("cycleWindowTotals");
    expect(src).toContain('label="Perioden"');
    expect(src).toContain("detail={cycleRange}");
    expect(src).toContain('onClick={() => choosePeriod("cycle")}');
    expect(src).toContain("subscribeMovementsDrill");
    expect(src).toContain("clearMovementsDrill");
    expect(src).not.toContain("setSource");
    expect(src).toContain("subscribeMovementsView");
    expect(src).not.toContain("Inga träffar för filtret — prova Alla eller All tid.");
  });

  it("keeps period and filter chips equal and stats off a phone 3-up", () => {
    expect(src).toContain("numa-equal-chips");
    expect(src).toContain("is-quad");
    expect(src).toContain("numa-stat-trio");
    expect(src).toContain("numa-money-line");
    expect(src).toContain("wrap={false}");
    expect(src).not.toContain("sm:grid-cols-3");
    expect(src).toContain("overflow-x-hidden");
  });

  it("shows last-known Rörelser, and a skeleton while the list is unknown", () => {
    expect(src).toContain("lastMovementsSnapshot");
    expect(src).toContain("rememberMovementsSnapshot");
    expect(src).toContain("const view = stored ?? data ?? null");
    expect(src).toContain("MovementsViewLoading");
    expect(src).not.toContain("pendingMovementsShell");
    expect(src).toContain("Inga rörelser här ännu.");
    expect(src).toContain("lastMovementsView");
    expect(src).toContain("applyMovementsEdit");
    expect(src).toContain("applyMovementsVoid");
    expect(src).toContain("captureOptimisticBalance");
    expect(src).toContain("undoOptimisticBalance");
    const voidClick = src.slice(src.indexOf('setPendingAction("void")'));
    expect(voidClick.indexOf("applyMovementsVoid")).toBeLessThan(
      voidClick.indexOf("await voidTransactionAction"),
    );
    expect(src).toContain('{ id: "other", label: "Annat" }');
    expect(src).not.toContain('{ id: "other", label: "Övrigt" }');
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
  });

  it("clears the category chip when leaving Rörelser", () => {
    expect(src).toContain('spaTabKey(prev) === "/transaktioner"');
    expect(src).toContain('spaTabKey(pathname) !== "/transaktioner"');
    expect(src).toContain("category: null");
  });

  it("sums a drill from the visible rows and does not store the drill chips", () => {
    expect(src).toContain("drillSummaryFromRows(filtered");
    expect(src).toContain("savedViewWithoutDrillFilters");
    expect(src).toContain("data-drill-summary");
    expect(src).toContain("expenseOnly");
  });
});
