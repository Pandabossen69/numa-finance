import { isNumaAdminEmail } from "@/domain/identity/admin";
import { isPlanIncome, isPlanSavings, type PlanItem } from "@/domain/finance";

export const GETTING_STARTED_TOTAL = 3;

export const GETTING_STARTED_SV = {
  title: "Kom igång",
  intro: "Tre korta steg. Gör nästa.",
  allDone: "Saldo, in och ut är på plats.",
  nextChip: "Gör nu",
} as const;

export type GettingStartedStepId = "saldo" | "income" | "bills";

export type GettingStartedStep = {
  id: GettingStartedStepId;
  label: string;
  why: string;
  href: string;
  done: boolean;
};

export type GettingStartedView = {
  visible: boolean;
  collapsed: boolean;
  allDone: boolean;
  doneCount: number;
  total: typeof GETTING_STARTED_TOTAL;
  steps: GettingStartedStep[];
};

const STEPS: Array<{
  id: GettingStartedStepId;
  label: string;
  why: string;
  href: string;
}> = [
  {
    id: "saldo",
    label: "Saldo just nu",
    why: "Så Hem visar vad du har.",
    href: "/kom-igang",
  },
  {
    id: "income",
    label: "Vad kommer in",
    why: "Lägg in lön eller CSN i Plan.",
    href: "/plan?steg=inkomst",
  },
  {
    id: "bills",
    label: "Vad måste betalas",
    why: "Lägg in hyra och räkningar i Plan.",
    href: "/plan?steg=utgift",
  },
];

export function isPlanBill(item: PlanItem): boolean {
  return item.isActive && !isPlanIncome(item) && !isPlanSavings(item);
}

export function buildGettingStartedView(input: {
  email: string;
  gettingStartedCompletedAt: string | null;
  gettingStartedCollapsed: boolean;
  hasSaldo: boolean;
  planItems: PlanItem[];
  /** Set when the user saved the required first-login saldo. */
  onboardingSaldoAt?: string | null;
}): GettingStartedView {
  const hasIncome = input.planItems.some(
    (item) => item.isActive && isPlanIncome(item),
  );
  const hasBills = input.planItems.some(isPlanBill);
  const done = {
    saldo: input.hasSaldo,
    income: hasIncome,
    bills: hasBills,
  };
  const steps = STEPS.map((step) => ({
    ...step,
    href: step.id === "saldo" && done.saldo ? "/idag" : step.href,
    done: done[step.id],
  }));
  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === GETTING_STARTED_TOTAL;
  const fromFirstRun = Boolean(input.onboardingSaldoAt);
  const alreadyHadData =
    !fromFirstRun && (input.hasSaldo || hasIncome || hasBills);
  const skip =
    isNumaAdminEmail(input.email) ||
    Boolean(input.gettingStartedCompletedAt) ||
    alreadyHadData;
  return {
    visible: !skip,
    collapsed: input.gettingStartedCollapsed,
    allDone,
    doneCount,
    total: GETTING_STARTED_TOTAL,
    steps,
  };
}

export function gettingStartedProgressLabel(doneCount: number, total: number): string {
  return `${doneCount} av ${total} klara`;
}

export function nextGettingStartedStep(
  view: GettingStartedView,
): GettingStartedStep | null {
  return view.steps.find((step) => !step.done) ?? null;
}

export function gettingStartedNextCta(id: GettingStartedStepId): string {
  if (id === "saldo") return "Sätt saldo";
  if (id === "income") return "Lägg in vad som kommer in";
  return "Lägg in vad som måste betalas";
}

/** Keep Kom igång in sync when Hem already has a saldo but the cache lags. */
export function reconcileGettingStartedWithSaldo(
  view: GettingStartedView,
  hasSaldo: boolean,
): GettingStartedView {
  if (!hasSaldo) return view;
  const saldo = view.steps.find((step) => step.id === "saldo");
  if (!saldo || saldo.done) return view;
  const steps = view.steps.map((step) =>
    step.id === "saldo" ? { ...step, done: true, href: "/idag" } : step,
  );
  const doneCount = steps.filter((step) => step.done).length;
  return {
    ...view,
    steps,
    doneCount,
    allDone: doneCount === view.total,
  };
}
