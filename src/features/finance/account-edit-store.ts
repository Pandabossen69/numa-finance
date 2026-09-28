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
import { userFacingSaveError } from "@/lib/net/offline-save";
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
const savedNames = new Map<string, string>();
const nameListeners = new Set<() => void>();

function emitSavedNames() {
  for (const listener of nameListeners) listener();
}

/** Name confirmed by the server this session. Detail soft-nav reads this. */
export function rememberSavedAccountName(id: string, name: string) {
  if (savedNames.get(id) === name) return;
  savedNames.set(id, name);
  emitSavedNames();
}

export function savedAccountName(id: string): string | null {
  return savedNames.get(id) ?? null;
}

export function subscribeSavedAccountNames(listener: () => void) {
  nameListeners.add(listener);
  return () => {
    nameListeners.delete(listener);
  };
}

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

export type AccountDetailsEditResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Paint the new name (and kind / valuta / förvalt) on Konton immediately,
 * then persist. `painted` is false when there is no list cache to patch.
 * `done` settles with the server result so the screen can stay put until then.
 */
export function publishAccountDetailsEdit(input: {
  id: string;
  name: string;
  kind: AccountKind;
  currency: CurrencyCode;
  makeDefault: boolean;
}): { painted: boolean; done: Promise<AccountDetailsEditResult> } {
  const failed = (error: string): AccountDetailsEditResult => ({
    ok: false,
    error,
  });
  const live = liveSession();
  if (!live) {
    return {
      painted: false,
      done: Promise.resolve(failed(ACCOUNT_EDIT_FAILED_SV)),
    };
  }
  const started = beginDetails(live, {
    accountId: input.id,
    name: input.name,
    kind: input.kind,
    kindLabelSv: ACCOUNT_KIND_LABEL_SV[input.kind],
    currency: input.currency,
    makeDefault: input.makeDefault,
  });
  if (!started) {
    return {
      painted: false,
      done: Promise.resolve(failed(ACCOUNT_EDIT_FAILED_SV)),
    };
  }
  setAccountEditError(null);
  paint(started.session, false);
  const generation = started.generation;
  const done = updateAccountAction({
    id: input.id,
    name: input.name,
    kind: input.kind,
    currency: input.currency,
    makeDefault: input.makeDefault,
  })
    .then((result): AccountDetailsEditResult => {
      if (!result.ok) {
        const error = userFacingSaveError(
          result.error,
          ACCOUNT_EDIT_FAILED_SV,
        );
        if (rollbackAccountEdit(input.id, generation)) setAccountEditError(error);
        return failed(error);
      }
      commitAccountEdit(input.id, generation);
      return { ok: true };
    })
    .catch((error): AccountDetailsEditResult => {
      const message = userFacingSaveError(error, ACCOUNT_EDIT_FAILED_SV);
      if (rollbackAccountEdit(input.id, generation)) setAccountEditError(message);
      return failed(message);
    });
  return { painted: true, done };
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
  const saved = session.snapshot.accounts.find((account) => account.id === accountId);
  if (saved) rememberSavedAccountName(accountId, saved.name);
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
  savedNames.clear();
  emitSavedNames();
  setAccountEditError(null);
}
