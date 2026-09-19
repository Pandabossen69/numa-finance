"use server";

import {
  loadAccountsSnapshot,
  type AccountsSnapshotResult,
} from "./load-accounts";

export type { AccountsSnapshot, AccountsSnapshotResult } from "./load-accounts";

/** Client refresh / dest catch-up — RSC pages should stay thin. */
export async function getAccountsSnapshotAction(): Promise<AccountsSnapshotResult> {
  return loadAccountsSnapshot();
}
