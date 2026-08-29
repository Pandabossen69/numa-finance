import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./HomeDashboard.tsx", import.meta.url), "utf8");

describe("Hem PWA hint and HIGH copy", () => {
  it("keeps the install hint below the dial as a compact bar", () => {
    expect(src).toContain('variant="bar"');
    expect(src.indexOf("DayDial")).toBeLessThan(src.lastIndexOf("HomescreenInstallHint"));
    expect(src).not.toMatch(/Lägg NUMA på hemskärmen/);
  });

  it("keeps the signed Över chip on the dial", () => {
    expect(src).toContain("Över");
    expect(src).toContain("numa-chip-alarm");
  });

  it("shows the Hem-shaped skeleton while snapshot is empty", () => {
    expect(src).toContain("HomeViewLoading");
  });

  it("keeps last-known Hem numbers and does not refresh the page after a spend", () => {
    expect(src).toContain("applyOptimisticHomeSpend");
    expect(src).toContain("applyMovementsAdd");
    expect(src).toContain("applyAccountDelta");
    expect(src).toContain("getHomeSnapshotAction");
    expect(src).toContain("warmupPlanPageData");
    expect(src).toContain("isHomeDirty");
    expect(src).toContain("if (snap && !isHomeDirty()) rememberHomeSnapshot(snap)");
    expect(src).not.toContain("lastHomeSnapshot() == null");
    expect(src).toContain("stored.userId === snap.userId");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
  });

  it("paints signed Över on the dial, not a clamped 0", () => {
    expect(src).toContain("dialCenterMinor");
    expect(src).toContain("overToday || remainingTodayMinor < 0");
    expect(src).toContain('"signed"');
  });

  it("does not show Mot planen as the Hem pile", () => {
    expect(src).toContain("CompactPiles");
    expect(src).toContain("overMinor");
    expect(src).not.toContain("livingSaldoMinor");
    expect(src).not.toContain("SV.motPlanen");
    expect(src).not.toContain("livingVsPlanHintSv");
  });

  it("says Sparar… while saldo buttons are busy, not Klart", () => {
    expect(src).toContain('{busy ? "Sparar…" : SV.visaDagsbudget}');
    expect(src).toContain('{busy ? "Sparar…" : "Spara"}');
    expect(src).not.toMatch(/busy \? "Klart"/);
  });

  it("blocks a second QuickExpense tap while the first save is in flight", () => {
    expect(src).toContain("if (guard.isRunning() || busy || !accountId) return");
    expect(src).toContain("disabled={busy || !amount.trim()}");
    expect(src).toContain('{busy ? "Sparar…" : "Spara"}');
    expect(src).toContain("useSubmitGuard");
    expect(src).toContain("guard.tryBegin()");
    expect(src).toContain("guard.end()");
  });

  it("keeps Dagsbudget and Spenderat on one line at phone width", () => {
    expect(src).toContain("numa-day-metrics");
    expect(src).toContain("is-budget");
    expect(src).toContain("is-spent");
    expect(src).toContain("numa-metric-label");
    expect(src).toContain("wrap={false}");
    expect(src).not.toContain('bg-[var(--numa-card)] pt-1');
  });

  it("does not dress the Kvar idag card as a tap target", () => {
    expect(src).toContain("numa-day-stage cursor-default");
    expect(src).not.toMatch(/numa-day-stage[^"]*numa-press/);
  });

  it("lets the ring and the sentence both talk about kvar, not spent-of-budget", () => {
    expect(src).toContain(
      "remainingTodayMinor, currency)} av ${formatMoneyHint(view.dayBudgetMinor, currency)} kvar",
    );
    expect(src).toContain("formatMoneyCompact");
    expect(src).toContain("usedRatio={dayUsedRatio}");
  });

  it("labels QuickExpense amount and note for a11y", () => {
    expect(src).toContain('aria-label="Anteckning"');
    expect(src).toContain('aria-label="Belopp"');
  });

  it("labels days until income as idag / N dagar kvar, not a bare 4 dagar", () => {
    expect(src).toContain("formatDaysUntilSv");
    expect(src).not.toContain('formatCountSv(view.spendDaysLeft, "dag", "dagar")');
  });

  it("teaches empty Hem in one Swedish sentence and hosts Kom igång", () => {
    expect(src).toContain("GettingStartedCard");
    expect(src).toContain("läget just nu");
    expect(src).not.toMatch(/välkommen till din resa/i);
  });

  it("does not tell a user with a saldo to set a saldo", () => {
    expect(src).toContain("const hasSaldo = view.calculatedBalanceMinor != null");
    expect(src).toContain(
      "Ingen dagsbudget än. Lägg in vad som kommer in i Plan.",
    );
    expect(src).toContain("Ingen dagsbudget än. Sätt saldo så räknas kvar idag.");
    expect(src).toMatch(/\{hasSaldo\s*\n?\s*\?/);
    expect(src).toContain('view.dayBudgetMinor > 0 ? null : "md:h-auto md:self-start"');
  });

  it("stacks the dial above piles on the phone and splits them only at md", () => {
    expect(src).toContain("grid min-w-0 items-stretch gap-5 md:grid-cols-2 md:gap-6");
    expect(src).toContain("grid min-w-0 grid-cols-2 gap-3");
    expect(src).not.toContain("grid-cols-2 md:grid-cols-2");
    expect(src).toContain("min-w-0 space-y-6");
  });

  it("keeps QuickExpense remaining off the title row on a 375px phone", () => {
    expect(src).toContain(
      "flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3",
    );
    expect(src).not.toContain("flex items-end justify-between gap-3");
  });

  it("keeps Hem chrome tap targets at least 44px", () => {
    expect(src).toContain("min-h-[5.25rem]");
    expect(src).toContain("min-h-12");
    expect(src).toContain(
      "numa-press inline-flex min-h-11 items-center font-semibold text-[var(--numa-accent)]",
    );
  });
});
