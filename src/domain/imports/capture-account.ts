import { compareId, compareIsoDesc } from "@/domain/finance/list-sort";

/**
 * Account the Fota review can choose before Bekräfta.
 * Inactive rows are included so the picker can ignore them explicitly.
 */
export type CaptureAccountCandidate = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  /** Latest non-voided transaction, else account updatedAt. */
  lastUsedAt: string | null;
};

export type CaptureAccountChoice =
  | {
      action: "use";
      accountId: string;
      name: string;
      currency: string;
    }
  | {
      action: "create";
      name: string;
      currency: string;
      noticeSv: string;
    };

const DEFAULT_NEW_ACCOUNT_NAME = "Bankapp";

/** Select value when Bekräfta must open a new account. */
export const CREATE_CAPTURE_ACCOUNT = "__create_capture_account__";

function normCurrency(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Which account a Fota confirm should post to.
 *
 * 1. Active preselected account in the movement currency — keep it.
 * 2. Otherwise the active accounts in that currency: the only one, or the
 *    most recently used when there are several.
 * 3. Create a new account only when none of those exist.
 * Archived / inactive rows are never chosen.
 */
export function chooseCaptureAccount(input: {
  movementCurrency: string;
  preselectedAccountId?: string | null;
  accounts: readonly CaptureAccountCandidate[];
  newAccountName?: string | null;
}): CaptureAccountChoice {
  const currency = normCurrency(input.movementCurrency);
  const active = input.accounts.filter((account) => account.isActive);
  const preselected = active.find(
    (account) => account.id === input.preselectedAccountId,
  );

  if (preselected && normCurrency(preselected.currency) === currency) {
    return {
      action: "use",
      accountId: preselected.id,
      name: preselected.name,
      currency,
    };
  }

  const matches = active.filter(
    (account) => normCurrency(account.currency) === currency,
  );
  if (matches.length === 1) {
    const only = matches[0]!;
    return {
      action: "use",
      accountId: only.id,
      name: only.name,
      currency,
    };
  }
  if (matches.length > 1) {
    const [latest] = [...matches].sort(
      (a, b) =>
        compareIsoDesc(a.lastUsedAt, b.lastUsedAt) || compareId(a.id, b.id),
    );
    return {
      action: "use",
      accountId: latest!.id,
      name: latest!.name,
      currency,
    };
  }

  const name = input.newAccountName?.trim() || DEFAULT_NEW_ACCOUNT_NAME;
  return {
    action: "create",
    name,
    currency,
    noticeSv: newCaptureAccountNotice(name, currency),
  };
}

export function newCaptureAccountNotice(name: string, currency: string): string {
  return `Nytt konto skapas: ${name} (${normCurrency(currency)})`;
}

type LedgerAccount = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  updatedAt?: string | null;
};

type LedgerTransaction = {
  accountId: string;
  occurredAt: string;
  status?: string | null;
};

/** Build picker rows from fixtures or a ledger read. Never touches user files. */
export function captureAccountCandidates(input: {
  accounts: readonly LedgerAccount[];
  transactions?: readonly LedgerTransaction[];
}): CaptureAccountCandidate[] {
  const lastUsed = new Map<string, string>();
  for (const tx of input.transactions ?? []) {
    if (tx.status === "voided") continue;
    const prev = lastUsed.get(tx.accountId);
    if (!prev || compareIsoDesc(tx.occurredAt, prev) < 0) {
      lastUsed.set(tx.accountId, tx.occurredAt);
    }
  }
  return input.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    isActive: account.isActive,
    lastUsedAt: lastUsed.get(account.id) ?? account.updatedAt ?? null,
  }));
}

type ShellRow = { id: string; name: string; currency?: string };
type KnownRow = {
  id: string;
  name: string;
  currency: string;
  isActive?: boolean;
};

/**
 * Shell accounts, then last-known Konton, then the upload payload.
 * Upload wins because it carries lastUsedAt.
 */
export function mergeCaptureAccountSources(input: {
  shell?: readonly ShellRow[];
  known?: readonly KnownRow[];
  uploaded?: readonly CaptureAccountCandidate[];
}): CaptureAccountCandidate[] {
  const byId = new Map<string, CaptureAccountCandidate>();
  for (const row of input.shell ?? []) {
    if (!row.currency) continue;
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      currency: row.currency,
      isActive: true,
      lastUsedAt: null,
    });
  }
  for (const row of input.known ?? []) {
    const prev = byId.get(row.id);
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      currency: row.currency,
      isActive: row.isActive !== false,
      lastUsedAt: prev?.lastUsedAt ?? null,
    });
  }
  for (const row of input.uploaded ?? []) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

/**
 * Turn a choice into a real account. Re-checks the row so a stale THB id
 * cannot mint a second SEK account when an active one already exists.
 */
export async function materializeCaptureAccount<
  T extends { id: string; currency: string; isActive: boolean },
>(input: {
  movementCurrency: string;
  preselectedAccountId?: string | null;
  newAccountName?: string | null;
  institution?: string | null;
  accounts: readonly CaptureAccountCandidate[];
  getAccount: (id: string) => Promise<T | null>;
  createAccount: (spec: {
    name: string;
    institution: string | null;
    currency: string;
  }) => Promise<T>;
}): Promise<{ account: T; created: boolean }> {
  const choice = chooseCaptureAccount({
    movementCurrency: input.movementCurrency,
    preselectedAccountId: input.preselectedAccountId,
    accounts: input.accounts,
    newAccountName: input.newAccountName,
  });
  if (choice.action === "use") {
    const account = await input.getAccount(choice.accountId);
    if (
      account &&
      account.isActive &&
      normCurrency(account.currency) === choice.currency
    ) {
      return { account, created: false };
    }
  }
  const name =
    choice.action === "create"
      ? choice.name
      : input.newAccountName?.trim() || DEFAULT_NEW_ACCOUNT_NAME;
  const currency =
    choice.action === "create"
      ? choice.currency
      : normCurrency(input.movementCurrency);
  const account = await input.createAccount({
    name,
    institution: input.institution?.trim() || name,
    currency,
  });
  return { account, created: true };
}
