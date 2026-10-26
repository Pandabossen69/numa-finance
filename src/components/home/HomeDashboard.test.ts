import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./HomeDashboard.tsx", import.meta.url), "utf8");

describe("Hem layout", () => {
  it("shows one hero, a thin bar and the formula behind Så räknas det", () => {
    expect(src).toContain("DayBudgetBar");
    expect(src).toContain("Så räknas det");
    expect(src).toContain("usedRatio={dayUsedRatio}");
    expect(src).not.toContain("<DayDial");
    expect(src).not.toContain("HomescreenInstallHint");
    expect(src).not.toContain("function QuickExpense");
    expect(src).not.toContain("Lägg till utgift");
    expect(src).not.toContain('id="lagg-utgift"');
    expect(src).not.toContain("numa-day-dial");
  });

  it("keeps the signed Över chip and a signed hero when kvar is negative", () => {
    expect(src).toContain("Över");
    expect(src).toContain("numa-chip-ink");
    expect(src).toContain("overToday || remainingTodayMinor < 0");
    expect(src).toContain('"signed"');
    expect(src).not.toContain("numa-chip-alarm");
  });

  it("shows the Hem-shaped skeleton while snapshot is empty", () => {
    expect(src).toContain("HemPending");
    expect(src).not.toContain("HomeViewLoading");
    expect(src).not.toContain("numa-skel h-40 w-40 rounded-full");
  });

  it("keeps last-known Hem numbers and does not refresh the page after a spend", () => {
    expect(src).toContain("scheduleQuietMenuWarm");
    const adopt = src.slice(
      src.indexOf("export function HomeDashboard"),
      src.indexOf("function AvailableNowCard"),
    );
    expect(adopt).toContain("scheduleQuietMenuWarm");
    expect(adopt).not.toContain("warmupPlanPageData");
    expect(adopt).not.toContain("getHomeSnapshotAction");
    expect(src).toContain("isHomeDirty");
    expect(src).toContain(
      "if (adoptSnap && snap && !isHomeDirty()) rememberHomeSnapshot(snap)",
    );
    expect(src).toContain("adoptSnap");
    expect(src).not.toContain("lastHomeSnapshot() == null");
    expect(src).toContain("stored.userId === snap.userId");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
    expect(src).not.toContain("revalidatePath");
  });

  it("does not show Mot planen as the Hem pile", () => {
    expect(src).toContain("PileLine");
    expect(src).toContain("overMinor");
    expect(src).toContain(
      "view.overMinor !== view.calculatedBalanceMinor",
    );
    expect(src).not.toContain("livingSaldoMinor");
    expect(src).not.toContain("SV.motPlanen");
    expect(src).not.toContain("livingVsPlanHintSv");
    expect(src).not.toContain("CompactPiles");
  });

  it("says Sparar… while saldo buttons are busy, not Klart", () => {
    expect(src).toContain('{busy ? "Sparar…" : SV.visaDagsbudget}');
    expect(src).not.toMatch(/busy \? "Klart"/);
    const available = src.slice(src.indexOf("function AvailableNowCard"));
    expect(available).toContain("Saldo nu");
    expect(available).not.toContain("SV.komIgång");
  });

  it("does not dress the Kvar idag card as a tap target", () => {
    expect(src).toContain("numa-day-stage");
    expect(src).toContain("cursor-default");
    expect(src).not.toMatch(/numa-day-stage[^"]*numa-press/);
  });

  it("keeps the key line about kvar without repeating the hero amount", () => {
    expect(src).toContain("Hela dagsbudgeten kvar");
    expect(src).toContain("formatMoneyCompact");
    expect(src).not.toContain(
      "remainingTodayMinor, currency)} av ${formatMoneyHint(view.dayBudgetMinor, currency)} kvar",
    );
  });

  it("labels days until income as idag / N dagar kvar, not a bare 4 dagar", () => {
    expect(src).toContain("formatDaysUntilSv");
    expect(src).not.toContain('formatCountSv(view.spendDaysLeft, "dag", "dagar")');
    expect(src).not.toContain("Hela dagsbudgeten kvar · ${daysWord}");
  });

  it("names the dagsbudget horizon as till nästa inkomst + date", () => {
    expect(src).toContain("SV.tillNastaInkomst");
    expect(src).toContain("fram till nästa inkomst");
    expect(src).not.toContain("fram till nästa intäkt");
    expect(src).not.toContain("view.cycleStartLabelSv && view.cycleEndLabelSv");
  });

  it("explains dagsbudget as cash pool ÷ days to payday behind the disclosure", () => {
    expect(src).toContain("livingBudgetHintSv");
    expect(src).toContain("view.dayBudgetMinor");
    expect(src).toContain("view.livingPoolMinor");
    expect(src).toContain("view.reservedUntilIncomeMinor");
    expect(src).toContain("inferReservedSavingsMinor");
    expect(src).toContain("labelMonthNameSv(view.monthKey)");
    expect(src).toContain("savingsMonthName");
    expect(src).toContain("savingsThisMonthMinor");
    expect(src).toContain("view.calculatedBalanceMinor");
    expect(src).toContain("view.daysUntilIncome");
    expect(src).toContain("showDayEnvelope");
    const formula = src.slice(src.indexOf("Så räknas det"));
    expect(formula).toContain("budgetLines");
    expect(formula).toContain("numa-living-math");
  });

  it("teaches empty Hem in one Swedish sentence and hosts Kom igång", () => {
    expect(src).toContain("GettingStartedCard");
    expect(src).toContain("lastGettingStarted");
    expect(src).toContain("subscribeGettingStarted");
    expect(src).toContain("reconcileGettingStartedWithSaldo");
    expect(src).toContain("läget just nu");
    expect(src).not.toMatch(/välkommen till din resa/i);
    const firstGuide = src.indexOf("isEmpty && checklist?.visible");
    const dayStage = src.indexOf("numa-day-stage");
    const laterGuide = src.indexOf("!isEmpty && checklist?.visible");
    expect(firstGuide).toBeGreaterThan(-1);
    expect(firstGuide).toBeLessThan(dayStage);
    expect(laterGuide).toBeGreaterThan(dayStage);
  });

  it("does not tell a user with a saldo to set a saldo", () => {
    expect(src).toContain("const hasSaldo = view.calculatedBalanceMinor != null");
    expect(src).toContain("Ingen dagsbudget än. Lägg in vad som kommer in i Plan.");
    expect(src).toContain("Ingen dagsbudget än. Sätt saldo så räknas kvar idag.");
    expect(src).toContain("DAGSBUDGET_BILLS_EXCEED_SALDO_SV");
    expect(src).toContain("unpaidBillsExceedSaldo");
    expect(src).toContain("Lägg in vad som kommer in");
    expect(src).toContain("PERIOD_ENDED_TITLE_SV");
    expect(src).toContain("PERIOD_ENDED_BODY_SV");
    expect(src).toContain("PERIOD_ENDED_CTA_SV");
    expect(src).toContain("view.dayEnvelopeOpen === false");
    expect(src).toContain("view.dayEnvelopePending === true");
    expect(src).toContain("Sätt saldo");
    expect(src).toContain('href={hasSaldo ? "/plan?steg=inkomst" : "/kom-igang"}');
    expect(src).toMatch(/\{hasSaldo\s*\n?\s*\?/);
  });

  it("stacks hero above one list on the phone", () => {
    expect(src).toContain("min-w-0 space-y-5");
    expect(src).not.toContain("md:grid-cols-2");
  });

  it("keeps Hem chrome tap targets at least 44px", () => {
    expect(src).toContain("min-h-12");
    expect(src).toContain("min-h-11");
  });

  it("puts a primary low-Kvar next-action on the hero, aimed at Fota", () => {
    const bar = src.indexOf("DayBudgetBar");
    const next = src.indexOf("LowKvarNextCta");
    const list = src.indexOf("SV.saldoOchSparande");
    expect(src).toContain("lowKvarNextAction");
    expect(src).toContain("data-numa-next-action");
    expect(src).toContain("action.href");
    expect(src).toContain("prefetch={false}");
    expect(src).toContain("SV.nastaSteg");
    expect(next).toBeGreaterThan(bar);
    expect(next).toBeLessThan(list);
    expect(src).not.toContain("remainingTodayOf");
    expect(src).not.toContain("last-home-cookie");
  });

  it("does not duplicate Fota/Plan as Hem action cards — + is the only capture entry", () => {
    expect(src).not.toContain('href="/fota" title={SV.fota}');
    expect(src).not.toContain("function ActionLink");
    expect(src).toContain('href="/konton"');
    expect(src).toContain("SV.saldoAllaKontonHint");
  });
});
