import {
  calculateAccountBalance,
  calculateSafeToSpend,
  filterTransactionsAfterCheckpoint,
  formatRelativeVerificationSv,
  hoursSince,
  isSameZonedDay,
  startOfZonedDay,
  startOfZonedMonth,
  sumSpending,
  type Account,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type Profile,
  type SourceObservation,
} from "@/domain/finance";
import { money, type CurrencyCode } from "@/domain/money";
import { LOCAL_DEMO_USER_ID, type NumaStoreData } from "./types";
import { readStore, updateStore } from "./local-store";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export async function getProfile(): Promise<Profile> {
  const store = await readStore();
  return store.profile;
}

export async function listAccounts(): Promise<Account[]> {
  const store = await readStore();
  return store.accounts.filter((a) => a.isActive);
}

export async function getAccount(accountId: string): Promise<Account | null> {
  const store = await readStore();
  return store.accounts.find((a) => a.id === accountId) ?? null;
}

export async function createAccount(input: {
  name: string;
  institution?: string | null;
  accountType: Account["accountType"];
  currency: CurrencyCode;
  maskedIdentifier?: string | null;
  makeDefault?: boolean;
}): Promise<Account> {
  const created = await updateStore((store) => {
    const ts = nowIso();
    if (input.makeDefault || store.accounts.length === 0) {
      for (const a of store.accounts) a.isDefault = false;
    }
    const account: Account = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      name: input.name.trim(),
      institution: input.institution?.trim() || null,
      accountType: input.accountType,
      currency: input.currency,
      maskedIdentifier: input.maskedIdentifier?.trim() || null,
      isActive: true,
      isDefault: input.makeDefault || store.accounts.length === 0,
      createdAt: ts,
      updatedAt: ts,
    };
    store.accounts.push(account);
  });
  return created.accounts[created.accounts.length - 1]!;
}

export async function createCheckpoint(input: {
  accountId: string;
  balanceMinor: number;
  verifiedAt?: string;
  source: string;
  note?: string | null;
}): Promise<BalanceCheckpoint> {
  const store = await readStore();
  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error("Kontot hittades inte");

  const updated = await updateStore((s) => {
    const ts = nowIso();
    const checkpoint: BalanceCheckpoint = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: input.accountId,
      balanceMinor: input.balanceMinor,
      currency: account.currency,
      verifiedAt: input.verifiedAt ?? ts,
      source: input.source,
      sourceObservationId: null,
      note: input.note ?? null,
      createdAt: ts,
    };
    s.checkpoints.push(checkpoint);
  });
  return updated.checkpoints[updated.checkpoints.length - 1]!;
}

export async function createManualExpense(input: {
  accountId: string;
  amountMinor: number;
  description?: string;
  category?: string | null;
  occurredAt?: string;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }

  const store = await readStore();
  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error("Kontot hittades inte");

  const updated = await updateStore((s) => {
    const ts = nowIso();
    const tx: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: input.accountId,
      counterAccountId: null,
      direction: "debit",
      transactionType: "expense",
      amountMinor: input.amountMinor,
      currency: account.currency,
      occurredAt: input.occurredAt ?? ts,
      description: input.description?.trim() || "Utgift",
      merchant: null,
      category: input.category ?? null,
      source: "manual",
      status: "confirmed",
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      syncStatus: "saved",
      createdAt: ts,
      updatedAt: ts,
    };
    s.transactions.push(tx);
  });
  return updated.transactions[updated.transactions.length - 1]!;
}

export async function createManualIncome(input: {
  accountId: string;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  const store = await readStore();
  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error("Kontot hittades inte");

  const updated = await updateStore((s) => {
    const ts = nowIso();
    const tx: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: input.accountId,
      counterAccountId: null,
      direction: "credit",
      transactionType: "income",
      amountMinor: input.amountMinor,
      currency: account.currency,
      occurredAt: input.occurredAt ?? ts,
      description: input.description?.trim() || "Inkomst",
      merchant: null,
      category: null,
      source: "manual",
      status: "confirmed",
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      syncStatus: "saved",
      createdAt: ts,
      updatedAt: ts,
    };
    s.transactions.push(tx);
  });
  return updated.transactions[updated.transactions.length - 1]!;
}

export async function createTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<{ out: CanonicalTransaction; inn: CanonicalTransaction }> {
  if (input.amountMinor <= 0) throw new Error("Beloppet måste vara större än noll");
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Välj två olika konton");
  }

  const store = await readStore();
  const from = store.accounts.find((a) => a.id === input.fromAccountId);
  const to = store.accounts.find((a) => a.id === input.toAccountId);
  if (!from || !to) throw new Error("Kontot hittades inte");
  if (from.currency !== to.currency) {
    throw new Error("Överföring mellan olika valutor kräver FX (ej i fas 0)");
  }

  let outId = "";
  let inId = "";
  await updateStore((s) => {
    const ts = nowIso();
    const occurredAt = input.occurredAt ?? ts;
    const description = input.description?.trim() || "Överföring";

    const out: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: from.id,
      counterAccountId: to.id,
      direction: "debit",
      transactionType: "transfer",
      amountMinor: input.amountMinor,
      currency: from.currency,
      occurredAt,
      description,
      merchant: null,
      category: null,
      source: "manual",
      status: "confirmed",
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      syncStatus: "saved",
      createdAt: ts,
      updatedAt: ts,
    };
    const inn: CanonicalTransaction = {
      ...out,
      id: newId(),
      accountId: to.id,
      counterAccountId: from.id,
      direction: "credit",
    };
    outId = out.id;
    inId = inn.id;
    s.transactions.push(out, inn);
  });

  const after = await readStore();
  return {
    out: after.transactions.find((t) => t.id === outId)!,
    inn: after.transactions.find((t) => t.id === inId)!,
  };
}

export async function listTransactions(accountId?: string): Promise<CanonicalTransaction[]> {
  const store = await readStore();
  return store.transactions
    .filter((t) => (accountId ? t.accountId === accountId : true))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function createScreenshotObservation(input: {
  notes?: string | null;
  institutionHint?: string | null;
  accountHint?: string | null;
}): Promise<SourceObservation> {
  const updated = await updateStore((s) => {
    const ts = nowIso();
    const observation: SourceObservation = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      kind: "screenshot",
      storagePath: null,
      institutionHint: input.institutionHint ?? "Bangkok Bank",
      accountHint: input.accountHint ?? null,
      status: "uploaded",
      capturedAt: ts,
      notes:
        input.notes ??
        "Skärmbild mottagen. OCR är inte inkopplad ännu — observation sparad för framtida import.",
      createdAt: ts,
      updatedAt: ts,
    };
    s.observations.push(observation);
  });
  return updated.observations[updated.observations.length - 1]!;
}

export async function listObservations(): Promise<SourceObservation[]> {
  const store = await readStore();
  return [...store.observations].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function latestCheckpointForAccount(
  store: NumaStoreData,
  accountId: string,
): BalanceCheckpoint | null {
  const list = store.checkpoints
    .filter((c) => c.accountId === accountId)
    .sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt));
  return list[0] ?? null;
}

export type TodaySnapshot = {
  profile: Profile;
  accounts: Account[];
  primaryAccount: Account | null;
  checkpoint: BalanceCheckpoint | null;
  calculatedBalanceMinor: number | null;
  balanceKind: "verified_checkpoint_only" | "calculated" | "unknown";
  verificationLabel: string | null;
  todaySpendingMinor: number;
  monthSpendingMinor: number;
  safeToSpendTodayMinor: number;
  safeToSpendWeekMinor: number;
  freeMinor: number;
  reservedMinor: number;
  bufferMinor: number;
  daysUntilIncome: number;
  recentTransactions: CanonicalTransaction[];
  currency: CurrencyCode;
};

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const store = await readStore();
  const profile = store.profile;
  const accounts = store.accounts.filter((a) => a.isActive);
  const primary =
    accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;

  if (!primary) {
    return {
      profile,
      accounts,
      primaryAccount: null,
      checkpoint: null,
      calculatedBalanceMinor: null,
      balanceKind: "unknown",
      verificationLabel: null,
      todaySpendingMinor: 0,
      monthSpendingMinor: 0,
      safeToSpendTodayMinor: 0,
      safeToSpendWeekMinor: 0,
      freeMinor: 0,
      reservedMinor: 0,
      bufferMinor: 0,
      daysUntilIncome: 17,
      recentTransactions: [],
      currency: profile.primaryCurrency,
    };
  }

  const checkpoint = latestCheckpointForAccount(store, primary.id);
  const accountTx = store.transactions.filter((t) => t.accountId === primary.id);
  const after = filterTransactionsAfterCheckpoint(accountTx, checkpoint);
  const calculated = calculateAccountBalance({
    checkpoint,
    transactionsAfterCheckpoint: after,
  });

  const timezone = profile.timezone;
  const now = new Date();
  const dayStart = startOfZonedDay(now, timezone);
  const monthStart = startOfZonedMonth(now, timezone);

  const todayTx = accountTx.filter(
    (t) =>
      t.status === "confirmed" &&
      isSameZonedDay(t.occurredAt, now, timezone) &&
      Date.parse(t.occurredAt) >= dayStart.getTime(),
  );
  const monthTx = accountTx.filter(
    (t) =>
      t.status === "confirmed" && Date.parse(t.occurredAt) >= monthStart.getTime(),
  );

  const currency = primary.currency;
  const todaySpending = sumSpending(todayTx, currency);
  const monthSpending = sumSpending(monthTx, currency);

  // Phase 0 placeholders for reserved/buffer until planning engine lands.
  const reservedMinor = 0;
  const bufferMinor = 0;
  const daysUntilIncome = 17;
  const available = calculated ?? money(0, currency);
  const safe = calculateSafeToSpend({
    available,
    reserved: money(reservedMinor, currency),
    safetyBuffer: money(bufferMinor, currency),
    daysUntilNextIncome: daysUntilIncome,
  });

  let balanceKind: TodaySnapshot["balanceKind"] = "unknown";
  if (checkpoint && after.length === 0) balanceKind = "verified_checkpoint_only";
  else if (checkpoint) balanceKind = "calculated";

  return {
    profile,
    accounts,
    primaryAccount: primary,
    checkpoint,
    calculatedBalanceMinor: calculated?.amountMinor ?? null,
    balanceKind,
    verificationLabel: checkpoint
      ? formatRelativeVerificationSv(checkpoint.verifiedAt, now)
      : null,
    todaySpendingMinor: todaySpending.amountMinor,
    monthSpendingMinor: monthSpending.amountMinor,
    safeToSpendTodayMinor: safe.today.amountMinor,
    safeToSpendWeekMinor: safe.week.amountMinor,
    freeMinor: safe.free.amountMinor,
    reservedMinor,
    bufferMinor,
    daysUntilIncome,
    recentTransactions: [...accountTx]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 8),
    currency,
  };
}

export { hoursSince };
