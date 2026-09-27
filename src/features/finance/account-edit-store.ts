"use client";

import {
  ACCOUNT_KIND_LABEL_SV,
  type AccountKind,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { updateAccountAction } from "@/features/finance/actions";
import {
  adoptServerAccounts,
  beginAccountBalanceEdit as beginBalance,
  beginAccountDetailsEdit as beginDetails,
  commitAccountEditSession,
  createAccountEditSession,
  refineAccountBalanceThb as refineBalance,
  rollbackAccountEditSession,
  type AccountEditSession,
} from "@/features/finance/account-edit-optimistic";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  applyHomeBankBalance,
  lastAccountsSnapshot,
  lastMovementsSnapshot,
  rememberAccountsSnapshot,
  rememberMovementsSnapshot,
  subscribeAccountsSnapshot,
} from "@/features/home/last-snapshot";

export const ACCOUNT_EDIT_FAILED_SV = "Kunde inte spara kontot";

let session: AccountEditSession | null = null;
let editError: string | null = null;
let listening = false;
const errorListeners = new Set<() => void>();

function ensureListening() {
  if (listening) return;
  listening = true;
  subscribeAccountsSnapshot(() => {
    if (!lastAccountsSnapshot()) {
      session = null;
      setAccountEditError(null);
    }
  });
}

function liveSession(): AccountEditSession | null {
  ensureListening();
  const snap = lastAccountsSnapshot();
  if (!snap) {
    session = null;
    return null;
  }
  if (!session) session = createAccountEditSession(snap);
  else if (session.snapshot !== snap) session = { ...session, snapshot: snap };
  return session;
}

function paint(next: AccountEditSession, syncBalance: boolean) {
  session = next;
  rememberAccountsSnapshot(next.snapshot, {
    dirty: next.inflight.size > 0,
  });
  if (!syncBalance || next.snapshot.totalThbMinor == null) return;
  applyHomeBankBalance(next.snapshot.totalThbMinor);
  const movements = lastMovementsSnapshot();
  if (!movements) return;
  rememberMovementsSnapshot(
    {
      ...movements,
      balanceMinor: next.snapshot.totalThbMinor,
      hasBankTruth: true,
    },
    { dirty: true },
  );
}

export function accountEditError(): string | null {
  return editError;
}

export function subscribeAccountEditError(listener: () => void) {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

function setAccountEditError(message: string | null) {
  if (editError === message) return;
  editError = message;
  for (const listener of errorListeners) listener();
}

/**
 * Paint the new name (and kind / valuta / förvalt) on Konton immediately,
 * then persist. Returns false when there is no list cache to patch.
 */
export function publishAccountDetailsEdit(input: {
  id: string;
  name: string;
  kind: AccountKind;
  currency: CurrencyCode;
  makeDefault: boolean;
}): boolean {
  const live = liveSession();
  if (!live) return false;
  const started = beginDetails(live, {
    accountId: input.id,
    name: input.name,
    kind: input.kind,
    kindLabelSv: ACCOUNT_KIND_LABEL_SV[input.kind],
    currency: input.currency,
    makeDefault: input.makeDefault,
  });
  if (!started) return false;
  setAccountEditError(null);
  paint(started.session, false);
  const generation = started.generation;
  void updateAccountAction({
    id: input.id,
    name: input.name,
    kind: input.kind,
    currency: input.currency,
    makeDefault: input.makeDefault,
  })
    .then((result) => {
      if (!result.ok) {
        if (rollbackAccountEdit(input.id, generation)) {
          setAccountEditError(result.error || ACCOUNT_EDIT_FAILED_SV);
        }
        return;
      }
      commitAccountEdit(input.id, generation);
    })
    .catch(() => {
      if (rollbackAccountEdit(input.id, generation)) {
        setAccountEditError(ACCOUNT_EDIT_FAILED_SV);
      }
    });
  return true;
}

export function beginAccountBalanceEdit(
  accountId: string,
  calculatedMinor: number,
  options?: { currency?: CurrencyCode; thbMinor?: number | null },
): number | null {
  const live = liveSession();
  if (!live) return null;
  const started = beginBalance(live, {
    accountId,
    calculatedMinor,
    currency: options?.currency,
    thbMinor: options?.thbMinor,
  });
  if (!started) return null;
  paint(started.session, true);
  return started.generation;
}

export function refineAccountBalanceThb(
  accountId: string,
  generation: number,
  thbMinor: number,
): boolean {
  if (!session) return false;
  const refined = refineBalance(session, accountId, generation, thbMinor);
  if (!refined.applied) return false;
  paint(refined.session, true);
  return true;
}

export function rollbackAccountEdit(
  accountId: string,
  generation: number,
): boolean {
  if (!session) return false;
  const edit = session.inflight.get(accountId);
  const rolled = rollbackAccountEditSession(session, accountId, generation);
  if (!rolled.rolledBack) return false;
  paint(rolled.session, edit?.balance ?? false);
  return true;
}

export function commitAccountEdit(
  accountId: string,
  generation: number,
): boolean {
  if (!session) return false;
  const wasBalance = session.inflight.get(accountId)?.balance ?? false;
  const committed = commitAccountEditSession(session, accountId, generation);
  if (!committed.committed) return false;
  session = committed.session;
  rememberAccountsSnapshot(session.snapshot, {
    dirty: session.inflight.size > 0,
  });
  if (wasBalance) {
    const movements = lastMovementsSnapshot();
    if (movements) rememberMovementsSnapshot(movements);
  }
  return true;
}

/** True when a stale refetch was held back in favour of the local edit. */
export function adoptServerAccountsSnapshot(
  incoming: AccountsSnapshot,
): boolean {
  ensureListening();
  if (!session || (session.inflight.size === 0 && session.guard.size === 0)) {
    return false;
  }
  const adopted = adoptServerAccounts(session, incoming);
  if (!adopted.changed) return false;
  const balanceInFlight = [...session.inflight.values()].some(
    (edit) => edit.balance,
  );
  paint(adopted.session, balanceInFlight);
  return true;
}

export function resetAccountEditStateForTests(): void {
  session = null;
  setAccountEditError(null);
}
