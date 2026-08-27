import { isNumaAdminEmail } from "@/domain/identity/admin";
import { isPlanIncome, isPlanSavings, type PlanItem } from "@/domain/finance";

export const GETTING_STARTED_TOTAL = 3;

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
    why: "Så Över på Hem stämmer.",
    href: "/kom-igang",
  },
  {
    id: "income",
    label: "Vad kommer in",
    why: "Lön eller CSN hör hemma i Plan.",
    href: "/plan?steg=inkomst",
  },
  {
    id: "bills",
    label: "Vad måste betalas",
    why: "Hyra och räkningar lägger du i Plan.",
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
  const skip =
    isNumaAdminEmail(input.email) || Boolean(input.gettingStartedCompletedAt);
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
