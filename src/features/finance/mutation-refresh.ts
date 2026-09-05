import { reportError } from "@/lib/observe/report";
import { refreshTodaySnapshot } from "@/lib/store/repository";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  accountsSnapshotFromToday,
  homeSnapshotFromToday,
  movementsSnapshotFromToday,
  planSnapshotFromToday,
} from "@/features/finance/snapshot-from-today";

export const SAVED_REFRESH_PENDING_SV = "Sparat. Uppdaterar siffrorna…";

export type MutationSnapshots = {
  home: HomeSnapshot;
  plan: PlanSnapshot;
  accounts: AccountsSnapshot;
  movements: MovementsSnapshot;
};

export type RefreshAfterWrite =
  | { refreshPending: false; snapshots: MutationSnapshots }
  | { refreshPending: true };

/**
 * After the durable write committed, a snapshot/revalidation failure must
 * not become a generic save-failed. The client keeps optimistic truth and
 * reconciles on the next successful read.
 */
export async function refreshAfterDurableWrite(
  revalidate: () => void,
): Promise<RefreshAfterWrite> {
  try {
    const snap = await refreshTodaySnapshot();
    revalidate();
    return {
      refreshPending: false,
      snapshots: {
        home: homeSnapshotFromToday(snap),
        plan: planSnapshotFromToday(snap),
        accounts: accountsSnapshotFromToday(snap),
        movements: movementsSnapshotFromToday(snap),
      },
    };
  } catch (error) {
    void reportError("mutation.refresh", error);
    return { refreshPending: true };
  }
}
