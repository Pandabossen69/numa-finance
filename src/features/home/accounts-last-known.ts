import type { AccountsSnapshot } from "@/features/finance/load-accounts";

export type AccountsLastKnownRefs = {
  /** Hem «På kontona» (calculatedBalanceMinor) or Plan bankBalanceMinor. */
  hemBalanceMinor?: number | null;
  /** Fresher account list — Plan TodaySnapshot / quiet-warm / Hem accounts. */
  fresherAccounts?: AccountsSnapshot | null;
};

export type AccountsLastKnownDecision = "keep" | "replace" | "invalidate";

function activeAccountIds(snap: AccountsSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const row of snap.accounts) {
    if (row.isActive === false) continue;
    if (row.id) ids.add(row.id);
  }
  return ids;
}

/** True when `incoming` drops an active id the incumbent already has. */
export function accountsSnapshotIsPoorer(
  incoming: AccountsSnapshot,
  incumbent: AccountsSnapshot,
): boolean {
  const incomingIds = activeAccountIds(incoming);
  for (const id of activeAccountIds(incumbent)) {
    if (!incomingIds.has(id)) return true;
  }
  return false;
}

/**
 * Quiet-warm / last-known may paint only when it agrees with Hem «På kontona»
 * and is not missing active ids a fresher source already has.
 *
 * A live Konton fetch is written via rememberAccountsSnapshot and is not
 * filtered here — this guard is for last-known / persist / gap-fill only.
 */
export function accountsLastKnownCanPaint(
  lastKnown: AccountsSnapshot | null,
  refs: AccountsLastKnownRefs = {},
): lastKnown is AccountsSnapshot {
  if (!lastKnown) return false;

  const hem = refs.hemBalanceMinor;
  if (
    hem != null &&
    lastKnown.totalThbMinor != null &&
    lastKnown.totalThbMinor !== hem
  ) {
    return false;
  }

  const fresher = refs.fresherAccounts;
  if (fresher) {
    const lastIds = activeAccountIds(lastKnown);
    for (const id of activeAccountIds(fresher)) {
      if (!lastIds.has(id)) return false;
    }
  }

  return true;
}

/**
 * What to do with last-known when Hem / Plan / quiet-warm presents a candidate.
 * Never keep a stale total or a strict subset of fresher ids. Never replace a
 * valid last-known with a poorer Plan TodaySnapshot (#138).
 */
export function decideAccountsLastKnown(
  current: AccountsSnapshot | null,
  incoming: AccountsSnapshot | null,
  refs: AccountsLastKnownRefs = {},
): AccountsLastKnownDecision {
  const hemRefs: AccountsLastKnownRefs = {
    hemBalanceMinor: refs.hemBalanceMinor,
  };
  const paintRefs: AccountsLastKnownRefs = {
    hemBalanceMinor: refs.hemBalanceMinor,
    fresherAccounts: incoming ?? refs.fresherAccounts ?? null,
  };

  if (current && accountsLastKnownCanPaint(current, paintRefs)) {
    return "keep";
  }

  if (incoming && accountsLastKnownCanPaint(incoming, hemRefs)) {
    if (current && accountsSnapshotIsPoorer(incoming, current)) {
      return "invalidate";
    }
    return "replace";
  }

  if (current) return "invalidate";
  return "keep";
}
