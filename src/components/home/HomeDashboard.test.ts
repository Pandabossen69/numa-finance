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

  it("lets Dagsbudget and Spenderat wrap at phone width", () => {
    expect(src).toContain("numa-day-metrics");
    expect(src).toContain("is-budget");
    expect(src).toContain("is-spent");
    expect(src).not.toContain('bg-[var(--numa-card)] pt-1');
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
});
