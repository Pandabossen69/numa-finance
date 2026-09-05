import { getPlanPageDataAction, type PlanPageDataResult } from "@/components/plan/load-plan";
import {
  lastPlanSnapshot,
  rememberGettingStarted,
  rememberPlanSnapshot,
  syncHomeLivingFromPlan,
  type PlanSnapshot,
} from "@/features/home/last-snapshot";

let inflight: Promise<PlanPageDataResult> | null = null;

function takeSnapshot(data: {
  items: PlanSnapshot["items"];
  currency: PlanSnapshot["currency"];
  timeZone: PlanSnapshot["timeZone"];
  bankBalanceMinor: PlanSnapshot["bankBalanceMinor"];
  spendingByMonthKey: PlanSnapshot["spendingByMonthKey"];
  ledgerTransactions: PlanSnapshot["ledgerTransactions"];
  accounts?: PlanSnapshot["accounts"];
  financeRevision: PlanSnapshot["financeRevision"];
  verifiedAt: PlanSnapshot["verifiedAt"];
  truthStatus: PlanSnapshot["truthStatus"];
}): PlanSnapshot {
  return {
    items: data.items,
    currency: data.currency,
    timeZone: data.timeZone,
    bankBalanceMinor: data.bankBalanceMinor,
    spendingByMonthKey: data.spendingByMonthKey,
    ledgerTransactions: data.ledgerTransactions,
    accounts: data.accounts,
    financeRevision: data.financeRevision,
    verifiedAt: data.verifiedAt,
    truthStatus: data.truthStatus,
  };
}

export function rememberLivePlan(snapshot: PlanSnapshot) {
  rememberPlanSnapshot(snapshot);
  syncHomeLivingFromPlan(snapshot);
}

export function warmupPlanPageData(): Promise<PlanPageDataResult> {
  if (!inflight) {
    inflight = getPlanPageDataAction()
      .then((result) => {
        if (result.ok) {
          const snapshot = takeSnapshot(result.data);
          rememberPlanSnapshot(snapshot);
          rememberGettingStarted(result.data.gettingStarted);
          syncHomeLivingFromPlan(snapshot);
        }
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function hasPlanSnapshot(): boolean {
  return lastPlanSnapshot() != null;
}
