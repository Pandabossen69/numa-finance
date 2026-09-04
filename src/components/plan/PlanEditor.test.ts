import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(name: string): string {
  return readFileSync(new URL(name, import.meta.url), "utf8");
}

const editor = read("./PlanEditor.tsx");
const rows = read("./PlanRows.tsx");
const dateField = read("./PlanDateField.tsx");
const inlineAdd = read("./InlineAdd.tsx");
const monthStrip = read("./MonthChipStrip.tsx");
const card = read("./PlanCard.tsx");
const equation = read("./PlanEquation.tsx");
const piles = read("./PlanPiles.tsx");
const format = read("./plan-format.ts");
const chip = read("./plan-chip.ts");
const monthNav = read("./PlanMonthNav.tsx");
const css = read("../../app/globals.css");

/** For rules that must hold across Plan, wherever the code happens to live. */
const plan = [
  editor,
  rows,
  dateField,
  inlineAdd,
  monthStrip,
  card,
  equation,
  format,
  chip,
  monthNav,
].join("\n");

describe("Plan file layout", () => {
  it("keeps the editor small enough to read and the row list on its own", () => {
    const lines = (text: string) => text.split("\n").length;
    expect(lines(editor)).toBeLessThan(1350);
    expect(lines(rows)).toBeLessThan(450);
    // The screens are composed, not one file.
    expect(editor).toContain('from "@/components/plan/PlanRows"');
    expect(editor).toContain('from "@/components/plan/InlineAdd"');
    expect(editor).toContain('from "@/components/plan/PlanCard"');
    expect(editor).toContain('from "@/components/plan/PlanMonthNav"');
    expect(editor).toContain('from "@/components/plan/plan-format"');
    // The row list owns the settle rule and does not reach back into the editor.
    expect(rows).not.toContain("PlanEditor");
    expect(rows).toContain("export function PlanRows(");
  });
});

describe("Plan dates and add-form", () => {
  it("labels Intäkter and Fasta utgifter with the same Swedish short date", () => {
    expect(editor).toContain("formatListDateSv(item.nextDueAt, timeZone)");
    expect(editor).toContain("labelIncomeDateSv");
    expect(plan).not.toContain("labelDayOfMonthSv");
  });

  it("shows Plan date inputs as Swedish calendar dates, not US mm/dd/yyyy", () => {
    expect(plan).toContain("PlanDateField");
    expect(dateField).toContain("formatIsoDateOnlySv");
    expect(dateField).toContain('lang="sv-SE"');
    expect(dateField).toContain("ÅÅÅÅ-MM-DD");
  });

  it("opens the picker from the native date input so a calendar tap can commit", () => {
    expect(dateField).toContain('className="numa-date-input"');
    expect(dateField).toContain("commitCalendarDate");
    expect(format).toContain("nextCommittedCalendarDate");
    expect(plan).not.toContain("onPointerDown");
    expect(plan).not.toContain("event.preventDefault");
    expect(plan).not.toContain("preventDefault()");
    expect(plan).not.toContain("openNativeDatePicker");
    expect(plan).not.toContain("showPicker");
    expect(plan).not.toContain("absolute inset-0 cursor-pointer opacity-0");
    expect(css).toContain(".numa-date-input");
    expect(css).not.toContain("::-webkit-calendar-picker-indicator");
    const dateCss = css.slice(
      css.indexOf(".numa-date-input"),
      css.indexOf(".numa-overflow-menu"),
    );
    expect(dateCss).not.toContain("pointer-events: none");
    expect(css).toContain(".numa-expand.is-open");
    expect(css).toContain("overflow: visible");
  });

  it("scrolls the submit row into view and pads above the FAB when adding", () => {
    expect(inlineAdd).toContain("scrollIntoView");
    expect(inlineAdd).toContain('block: "nearest"');
    expect(inlineAdd).toContain(
      "pb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+1.75rem)] md:pb-0",
    );
    expect(inlineAdd).toContain(
      "scroll-mb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)",
    );
    expect(inlineAdd).toContain("md:scroll-mb-0");
  });

  it("does not keep the add toggle over the fields while they expand", () => {
    expect(inlineAdd).toContain("fieldsMounted");
    expect(inlineAdd).toContain("const showFields = open || fieldsMounted");
    expect(inlineAdd).toContain("onTransitionEnd");
  });

  it("keeps month context and fades the chip strip only when it overflows", () => {
    expect(editor).toContain("rememberPlanView");
    expect(editor).toContain("lastPlanView");
    expect(monthNav).toContain("MonthChipStrip");
    expect(monthStrip).toContain("is-overflow-start");
    expect(plan).not.toContain("numa-month-strip -mx-1");
  });

  it("lets users browse earlier months and years without rewriting history", () => {
    expect(monthNav).toContain("visibleMonthKeysForYear");
    expect(editor).toContain("onShiftYear={shiftYear}");
    expect(monthNav).toContain('aria-label="Föregående år"');
    expect(monthNav).toContain("Bläddra bakåt och framåt — historik ändras inte");
    expect(monthNav).toContain("min-h-11 rounded-full px-3");
    expect(plan).not.toContain("även år framåt");
  });

  it("opens the matching add form when Kom igång sends steg", () => {
    expect(editor).toContain("focusAdd");
    expect(editor).toContain("stepHint");
    expect(editor).toContain("scrollOnOpen");
    expect(editor).toContain('banner={focusAdd === "income" ? stepHint : null}');
    expect(editor).toContain("setAddKind(focusAdd)");
  });

  it("computes Över from cash coverage, not Mot planen leftover", () => {
    expect(editor).toContain("projectCashCoverage");
    expect(editor).toContain("ledgerTransactions");
    expect(editor).toContain("coverage={coverage}");
  });

  it("lets every month mark Betald or Mottagen without deleting", () => {
    expect(editor).toContain("setPlanItemSettledAction");
    expect(editor).toContain("onSettle={settleRow}");
    expect(editor).toContain("previewPlanSettleEffect");
    expect(editor).toContain("applyOptimisticPlanSettle");
    expect(editor).toContain("applyAccountDelta");
    expect(rows).toContain("planDoneLabel");
    expect(rows).toContain("planPartialLabel");
    expect(editor).toContain('settleKind="income"');
    expect(editor).toContain('settleKind="expense"');
    expect(rows).toContain("SV.angraKlar");
    expect(plan).not.toContain("locked={isPastMonth}");
  });

  it("shows Betald/Mottagen in mint and Delvis in clay, without a Klar button", () => {
    expect(rows).toContain("numa-plan-row");
    expect(rows).toContain("is-settled");
    expect(rows).toContain("is-partial");
    // The chip's words and colour live in one module that Analys shares.
    expect(chip).toContain("numa-chip numa-chip-mint");
    expect(chip).toContain("numa-chip numa-chip-spend");
    expect(rows).toContain("planChipClass(status)");
    expect(rows).toContain("planChipLabel(status, settleKind)");
    expect(rows).toContain("<button");
    // The dead span is gone: a chip only exists when the user tapped it, and
    // then it must be an Ångra control.
    expect(rows).not.toContain('<span className="numa-chip numa-chip-mint self-end">');
    expect(rows).toContain("onClick={() => onSettle(item.id, false)}");
    expect(rows).not.toContain("onClick={() => onSettle(item.id, true)}");
    expect(rows).toContain("numa-plan-list");
    expect(rows).toContain("numa-plan-figures");
    expect(rows).toContain("wrap={false}");
    expect(css).toContain(".numa-plan-row.is-settled");
    expect(css).toContain(".numa-plan-row.is-partial");
    expect(css).toContain("var(--numa-positive)");
    expect(css).toContain("var(--numa-spend)");
  });

  it("puts Betald last, Delvis just above, and lets Ångra undo both", () => {
    expect(rows).toContain("sortPlanRowsForList");
    expect(rows).toContain("canUndo");
    expect(rows).toContain("aria-label={`Ångra ${settled ? doneLabel : partialLabel}`}");
    expect(rows).toContain("SV.angraKlar");
  });

  it("paints a row from the user's taps only, never from a ledger match", () => {
    // One derivation, owned by the domain, taking only the item.
    expect(rows).toContain(
      "const { status, settled, partial, canUndo } = planRowView(item)",
    );
    expect(rows).not.toContain("isPlanSettled(item)");
    expect(rows).not.toContain("isPlanPartiallySettled(item)");
    // Nothing in Plan hands the matcher result to a row.
    expect(plan).not.toContain("matchedIds={");
    expect(rows).not.toContain("matchedIds");
    expect(rows).not.toContain("matchPlanItemsToLedger");
    expect(plan).not.toContain("const matched =");
    expect(plan).not.toContain("matched &&");
    expect(plan).not.toContain("explicitSettled");
    // Money totals use confirmed links only — heuristic stays a suggestion.
    expect(editor).not.toContain("matchPlanItemsToLedger");
    expect(editor).toContain("explicitlyLinkedPlanItemIds");
    expect(editor).toContain("suggestPlanLinks");
    expect(editor).toContain(
      "sumCountsTowardCashMinor(projection.incomes, linkedPlanIds)",
    );
    expect(rows).toContain("sortPlanRowsForList(items)");
  });

  it("opens row actions in a portal so a panel cannot clip or shift them", () => {
    const menu = read("../ui/OverflowMenu.tsx");
    expect(menu).toContain("createPortal");
    expect(menu).toContain("document.body");
    expect(menu).toContain("fixed z-[70]");
    expect(menu).not.toContain("absolute right-0");
    // Flip up when the dock would cover a downward menu.
    expect(menu).toContain("DOCK_CLEARANCE");
    expect(menu).toContain('menu.classList.toggle("is-up", up)');
    expect(menu).toContain("requestAnimationFrame");
    expect(menu).toContain('window.addEventListener("scroll"');
    expect(css).toContain(".numa-overflow-menu.is-up");
    expect(css).toContain("numa-menu-in-up");
  });

  it("does not yank the page when the add card opens", () => {
    expect(plan).not.toContain('block: "start"');
    expect(plan).toContain('block: "nearest"');
  });

  it("publishes the plan store after commit, never from inside an updater", () => {
    expect(editor).toContain("useEffect(() => {\n    publishItems(localItems);");
    expect(editor).not.toMatch(/setLocalItems\(\(current\) => \{[^}]*publishItems/);
    expect(editor).toContain("adoptServerPlanItems(localItems, items)");
    expect(editor).toContain("setItemsStamp(adoptedStamp)");
    // Live coverage must not re-trigger publish (Delvis settle loop).
    expect(editor).toContain(
      "[localItems, currency, timeZone, bankBalanceMinor, spendingByMonthKey, ledgerTransactions]",
    );
    expect(editor).not.toContain(
      "[localItems, currency, timeZone, coverageSaldoMinor, spendingByMonthKey, ledgerTransactions]",
    );
  });

  it("shows 51 000 − 22 000 = 29 000 and labels remaining cash as Kvar att få/betala", () => {
    expect(rows).toContain("planRowHeroMinor");
    expect(rows).toContain("planPartialBreakdown");
    expect(rows).toContain("previewAdditionalPartialRemaining");
    expect(rows).toContain("PlanEquation");
    expect(equation).toContain("formatPlanFigure");
    expect(editor).toContain("coverage={coverage}");
    expect(piles).toContain("coverage.incomingMinor");
    expect(piles).toContain("coverage.unpaidMinor");
    expect(editor).toContain("sumCountsTowardCashMinor");
  });

  it("uses a calendar date on new and existing incomes and expenses", () => {
    expect(plan).not.toContain('editExtraType="day"');
    expect(plan).not.toContain('extraType="day"');
    expect(editor).toContain("expenseDate");
    expect(plan).not.toContain("Låst — passerad månad");
    expect(editor).toContain("createPlanItemAction");
  });

  it("lets Delvis betald / mottagen take an amount and a date for the rest", () => {
    expect(rows).toContain("planPartialLabel");
    expect(rows).toContain("remainingDatePrompt");
    expect(editor).toContain("När kommer resten?");
    expect(editor).toContain("När ska resten betalas?");
    expect(editor).toContain("partialDate");
    expect(editor).toContain("remainingDate");
    expect(editor).toContain("applyPlanItemEdits");
    expect(rows).toContain("remainingDueIso(item)");
    expect(rows).toContain("Lägg till mottaget");
    expect(rows).toContain("Markera resten mottagen");
    expect(rows).toContain("onMarkRemainder");
  });

  it("reconciles mutations locally and does not refresh the whole page", () => {
    expect(editor).toContain("rememberLivePlan");
    expect(editor).toContain("adoptMutationFinance");
    expect(editor).toContain("previous?.ledgerTransactions");
    expect(editor).toContain("publishItems");
    expect(plan).not.toContain("refreshQuiet");
    expect(plan).not.toContain("router.refresh");
    expect(plan).not.toContain("useRouter");
  });

  it("lands a new row immediately and closes add without emptying the form first", () => {
    expect(editor).toContain("function commitAdd");
    expect(editor).toContain("setAddKind(null)");
    expect(editor).toContain("adoptServerPlanItems");
    expect(rows).toContain("is-fresh");
    expect(css).toContain(".numa-plan-row.is-fresh");
    expect(css).toContain("numa-row-in");
    const commit = editor.slice(
      editor.indexOf("function commitAdd"),
      editor.indexOf("function settleRow"),
    );
    expect(commit).toContain("setAddKind(null)");
    expect(commit).toContain("runMutation");
    expect(commit.indexOf("setAddKind(null)")).toBeLessThan(
      commit.indexOf("void runMutation"),
    );
    expect(commit).not.toContain("} else {\n                  setAddKind(null);");
  });
});
