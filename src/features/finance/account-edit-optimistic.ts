import type { AccountKind } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import type {
  AccountBalanceRow,
  AccountsSnapshot,
} from "@/features/finance/load-accounts";

/**
 * Optimistic Konton edits (name + saldo).
 *
 * A generation is the latest local write for one account. A server response
 * may roll back or refine only when it still owns that generation, so a late
 * success or failure cannot wipe a newer local name or saldo.
 */

export type AccountEditSession = {
  snapshot: AccountsSnapshot;
  generation: Map<string, number>;
  inflight: Map<string, InflightAccountEdit>;
  guard: Map<string, AccountEditGuard>;
};

type InflightAccountEdit = {
  generation: number;
  previousRow: AccountBalanceRow;
  /**
   * Oldest baseline still newer than the server, including an edit this
   * save replaced. A refetch of that baseline must not win.
   */
  guardPrevious: GuardFields;
  /** isDefault per account, set only when this save changes the default. */
  previousDefaults: Map<string, boolean> | null;
  balance: boolean;
};

type GuardFields = {
  name: string;
  kind: AccountKind;
  kindLabelSv: string;
  currency: CurrencyCode;
  isDefault: boolean;
  calculatedMinor: number | null;
  thbMinor: number | null;
};

type AccountEditGuard = {
  generation: number;
  previous: GuardFields;
  next: GuardFields;
  defaults: boolean;
};

const GUARD_KEYS = [
  "name",
  "kind",
  "kindLabelSv",
  "currency",
  "isDefault",
  "calculatedMinor",
  "thbMinor",
] as const satisfies readonly (keyof GuardFields)[];

export function createAccountEditSession(
  snapshot: AccountsSnapshot,
): AccountEditSession {
  return {
    snapshot,
    generation: new Map(),
    inflight: new Map(),
    guard: new Map(),
  };
}

export function sumAccountThb(
  accounts: readonly AccountBalanceRow[],
): number | null {
  let total: number | null = null;
  for (const row of accounts) {
    const thb =
      row.thbMinor ?? (row.currency === "THB" ? row.calculatedMinor : null);
    if (thb == null) continue;
    total = (total ?? 0) + thb;
  }
  return total;
}

export function beginAccountDetailsEdit(
  session: AccountEditSession,
  input: {
    accountId: string;
    name: string;
    kind: AccountKind;
    kindLabelSv: string;
    currency: CurrencyCode;
    makeDefault: boolean;
  },
): { session: AccountEditSession; generation: number } | null {
  const row = session.snapshot.accounts.find(
    (account) => account.id === input.accountId,
  );
  if (!row) return null;

  const name = input.name.trim();
  const makeDefault = input.makeDefault && !row.isDefault;
  const previousDefaults = makeDefault
    ? new Map(
        session.snapshot.accounts.map((account) => [
          account.id,
          account.isDefault,
        ]),
      )
    : null;
  const nextRow: AccountBalanceRow = {
    ...row,
    name,
    kind: input.kind,
    kindLabelSv: input.kindLabelSv,
    currency: input.currency,
    isDefault: makeDefault ? true : row.isDefault,
  };
  const accounts = session.snapshot.accounts.map((account) => {
    if (account.id === input.accountId) return nextRow;
    if (makeDefault && account.isDefault) {
      return { ...account, isDefault: false };
    }
    return account;
  });
  return startEdit(session, input.accountId, {
    previousRow: { ...row },
    previousDefaults,
    balance: false,
    snapshot: withAccounts(session.snapshot, accounts),
  });
}

export function beginAccountBalanceEdit(
  session: AccountEditSession,
  input: {
    accountId: string;
    calculatedMinor: number;
    currency?: CurrencyCode;
    thbMinor?: number | null;
  },
): { session: AccountEditSession; generation: number } | null {
  const row = session.snapshot.accounts.find(
    (account) => account.id === input.accountId,
  );
  if (!row) return null;

  const currency = input.currency ?? row.currency;
  const thbMinor = nextThbMinor(row, input.calculatedMinor, currency, input.thbMinor);
  const accounts = session.snapshot.accounts.map((account) =>
    account.id === input.accountId
      ? {
          ...account,
          calculatedMinor: input.calculatedMinor,
          thbMinor,
          currency,
        }
      : account,
  );
  return startEdit(session, input.accountId, {
    previousRow: { ...row },
    previousDefaults: null,
    balance: true,
    snapshot: withAccounts(session.snapshot, accounts),
  });
}

/** Server THB for the same save. Ignored when a newer local edit exists. */
export function refineAccountBalanceThb(
  session: AccountEditSession,
  accountId: string,
  generation: number,
  thbMinor: number,
): { session: AccountEditSession; applied: boolean } {
  if (!owns(session, accountId, generation)) {
    return { session, applied: false };
  }
  const accounts = session.snapshot.accounts.map((row) =>
    row.id === accountId ? { ...row, thbMinor } : row,
  );
  return {
    session: {
      ...session,
      snapshot: withAccounts(session.snapshot, accounts),
    },
    applied: true,
  };
}

export function rollbackAccountEditSession(
  session: AccountEditSession,
  accountId: string,
  generation: number,
): { session: AccountEditSession; rolledBack: boolean } {
  const edit = session.inflight.get(accountId);
  if (!edit || !owns(session, accountId, generation)) {
    return { session, rolledBack: false };
  }
  const accounts = session.snapshot.accounts.map((row) => {
    if (row.id === accountId) return restoreRow(row, edit);
    if (edit.previousDefaults) {
      const previous = edit.previousDefaults.get(row.id);
      if (previous !== undefined && previous !== row.isDefault) {
        return { ...row, isDefault: previous };
      }
    }
    return row;
  });
  const inflight = new Map(session.inflight);
  inflight.delete(accountId);
  return {
    session: {
      ...session,
      inflight,
      snapshot: withAccounts(session.snapshot, accounts),
    },
    rolledBack: true,
  };
}

export function commitAccountEditSession(
  session: AccountEditSession,
  accountId: string,
  generation: number,
): { session: AccountEditSession; committed: boolean } {
  const edit = session.inflight.get(accountId);
  if (!edit || !owns(session, accountId, generation)) {
    return { session, committed: false };
  }
  const row = session.snapshot.accounts.find((account) => account.id === accountId);
  const inflight = new Map(session.inflight);
  inflight.delete(accountId);
  const guard = new Map(session.guard);
  if (row) {
    guard.set(accountId, {
      generation,
      previous: edit.guardPrevious,
      next: guardFields(row),
      defaults:
        edit.previousDefaults != null ||
        edit.guardPrevious.isDefault !== row.isDefault,
    });
  }
  return {
    session: { ...session, inflight, guard },
    committed: true,
  };
}

/**
 * Keep a newer local name/saldo when a refetch still carries the pre-edit row.
 * A genuinely different server value (neither previous nor the local next)
 * is adopted and the guard is dropped.
 */
export function adoptServerAccounts(
  session: AccountEditSession,
  incoming: AccountsSnapshot,
): { session: AccountEditSession; changed: boolean } {
  if (session.inflight.size === 0 && session.guard.size === 0) {
    return { session, changed: false };
  }

  const localById = new Map(
    session.snapshot.accounts.map((row) => [row.id, row]),
  );
  const guard = new Map(session.guard);
  let overlaid = false;
  let forceDefaults = false;

  const accounts = incoming.accounts.map((row) => {
    if (session.inflight.has(row.id)) {
      overlaid = true;
      const inflight = session.inflight.get(row.id);
      if (inflight?.previousDefaults) forceDefaults = true;
      return localById.get(row.id) ?? row;
    }
    const held = guard.get(row.id);
    if (!held) return row;
    if (isStaleServerRow(row, held)) {
      overlaid = true;
      if (held.defaults) forceDefaults = true;
      return localById.get(row.id) ?? row;
    }
    if (sameGuardFields(guardFields(row), held.next)) {
      return row;
    }
    guard.delete(row.id);
    return row;
  });

  const withDefaults = forceDefaults
    ? applyLocalDefaults(accounts, session.snapshot.accounts)
    : accounts;
  const snapshot: AccountsSnapshot = {
    ...incoming,
    accounts: withDefaults,
    archivedAccounts:
      incoming.archivedAccounts ?? session.snapshot.archivedAccounts,
    totalThbMinor: overlaid || forceDefaults
      ? sumAccountThb(withDefaults)
      : incoming.totalThbMinor,
  };
  return {
    session: { ...session, guard, snapshot },
    changed: true,
  };
}

function startEdit(
  session: AccountEditSession,
  accountId: string,
  edit: {
    previousRow: AccountBalanceRow;
    previousDefaults: Map<string, boolean> | null;
    balance: boolean;
    snapshot: AccountsSnapshot;
  },
): { session: AccountEditSession; generation: number } {
  const generation = (session.generation.get(accountId) ?? 0) + 1;
  const generations = new Map(session.generation);
  generations.set(accountId, generation);
  const inflight = new Map(session.inflight);
  const previousInflight = inflight.get(accountId);
  inflight.set(accountId, {
    generation,
    previousRow: edit.previousRow,
    guardPrevious: chainGuardPrevious(
      session.guard.get(accountId),
      previousInflight,
      guardFields(edit.previousRow),
    ),
    previousDefaults: edit.previousDefaults,
    balance: edit.balance,
  });
  const guard = new Map(session.guard);
  guard.delete(accountId);
  return {
    generation,
    session: {
      snapshot: edit.snapshot,
      generation: generations,
      inflight,
      guard,
    },
  };
}

function chainGuardPrevious(
  held: AccountEditGuard | undefined,
  inflight: InflightAccountEdit | undefined,
  currentPrevious: GuardFields,
): GuardFields {
  if (inflight) {
    return overlayChanged(
      currentPrevious,
      inflight.guardPrevious,
      (key) => inflight.guardPrevious[key] !== currentPrevious[key],
    );
  }
  if (!held) return currentPrevious;
  return overlayChanged(
    currentPrevious,
    held.previous,
    (key) => held.previous[key] !== held.next[key],
  );
}

function overlayChanged(
  base: GuardFields,
  older: GuardFields,
  changed: (key: keyof GuardFields) => boolean,
): GuardFields {
  return {
    name: changed("name") ? older.name : base.name,
    kind: changed("kind") ? older.kind : base.kind,
    kindLabelSv: changed("kindLabelSv") ? older.kindLabelSv : base.kindLabelSv,
    currency: changed("currency") ? older.currency : base.currency,
    isDefault: changed("isDefault") ? older.isDefault : base.isDefault,
    calculatedMinor: changed("calculatedMinor")
      ? older.calculatedMinor
      : base.calculatedMinor,
    thbMinor: changed("thbMinor") ? older.thbMinor : base.thbMinor,
  };
}

function owns(
  session: AccountEditSession,
  accountId: string,
  generation: number,
): boolean {
  return (
    session.generation.get(accountId) === generation &&
    session.inflight.get(accountId)?.generation === generation
  );
}

function withAccounts(
  snapshot: AccountsSnapshot,
  accounts: AccountBalanceRow[],
): AccountsSnapshot {
  return {
    ...snapshot,
    accounts,
    totalThbMinor: sumAccountThb(accounts),
  };
}

function nextThbMinor(
  row: AccountBalanceRow,
  calculatedMinor: number,
  currency: CurrencyCode,
  explicit: number | null | undefined,
): number | null {
  if (explicit !== undefined) return explicit;
  if (currency === "THB") return calculatedMinor;
  if (
    row.currency === currency &&
    row.fxRate != null &&
    row.fxRate > 0
  ) {
    return Math.round(calculatedMinor * row.fxRate);
  }
  return null;
}

function restoreRow(
  current: AccountBalanceRow,
  edit: InflightAccountEdit,
): AccountBalanceRow {
  const previous = edit.previousRow;
  if (edit.balance) {
    return {
      ...current,
      calculatedMinor: previous.calculatedMinor,
      thbMinor: previous.thbMinor,
      currency: previous.currency,
    };
  }
  return {
    ...current,
    name: previous.name,
    kind: previous.kind,
    kindLabelSv: previous.kindLabelSv,
    currency: previous.currency,
    isDefault: previous.isDefault,
  };
}

function guardFields(row: AccountBalanceRow): GuardFields {
  return {
    name: row.name,
    kind: row.kind,
    kindLabelSv: row.kindLabelSv,
    currency: row.currency,
    isDefault: row.isDefault,
    calculatedMinor: row.calculatedMinor,
    thbMinor: row.thbMinor,
  };
}

function sameGuardFields(left: GuardFields, right: GuardFields): boolean {
  return GUARD_KEYS.every((key) => left[key] === right[key]);
}

function isStaleServerRow(
  row: AccountBalanceRow,
  guard: AccountEditGuard,
): boolean {
  const incoming = guardFields(row);
  const changed = GUARD_KEYS.filter(
    (key) => guard.previous[key] !== guard.next[key],
  );
  if (changed.length === 0) return false;
  if (changed.every((key) => incoming[key] === guard.next[key])) return false;
  return changed.some((key) => incoming[key] === guard.previous[key]);
}

function applyLocalDefaults(
  accounts: AccountBalanceRow[],
  local: readonly AccountBalanceRow[],
): AccountBalanceRow[] {
  const flags = new Map(local.map((row) => [row.id, row.isDefault]));
  return accounts.map((row) => {
    const isDefault = flags.get(row.id);
    if (isDefault === undefined || isDefault === row.isDefault) return row;
    return { ...row, isDefault };
  });
}
