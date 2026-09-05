import {
  allocateErrorMessageSv,
  applyAllocateInMemory,
  accountTypeForKind,
  assertAccountAcceptsWrites,
  assertCurrencyAllowedForKind,
  evaluateArchiveAccount,
  evaluateCurrencyChange,
  evaluateDeleteAccount,
  evaluateKindChange,
  evaluateRestoreAccount,
  requireLifecycle,
  NEXT_INCOME_NAME,
  hoursSince,
  resolveSmsTipBalanceMinor,
  shouldWriteSmsTipCheckpoint,
  decideSmsBatchConfirm,
  collectPairedVoidIds,
  resolveSmsBatchOccurredAt,
  zonedDayKey,
  type Account,
  type AccountKind,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type ExtractedTransactionCandidate,
  type ExtractionRun,
  type PlanCategoryKind,
  type PlanItem,
  type Profile,
  type SourceObservation,
  type TransactionSource,
} from "@/domain/finance";
import { type CurrencyCode } from "@/domain/money";
import { createExtractionProvider, resolveScreenshotImport } from "@/domain/imports";
import { rankForOnTrackDays } from "@/domain/gamification";
import { observationsDueForPurge } from "@/features/imports/observation-retention";
import { LOCAL_DEMO_USER_ID, type NumaStoreData } from "./types";
import { readStore, updateStore } from "./local-store";
import { accountLifecycleFacts } from "./account-lifecycle-store";
import { inferAccountKind } from "./account-kind-infer";
import { resolveCheckpointFx } from "./checkpoint-fx";
import { assertUserOwnsStoragePath, buildUserStoragePath } from "./isolation";
import type { ConfirmReceiptInput, ReceiptUploadResult } from "./receipt-types";
import { emptyUserProgress, type UserProgress } from "./types-progress";
import type { TodaySnapshot } from "./types-snapshot";
import { assembleTodaySnapshot } from "./assemble-today-snapshot";
import {
  applySettleInMemory,
  type AtomicLinkResult,
  type AtomicSettleResult,
} from "./settle-atomic";
import { fxFieldsForWrite, recomputeThbFromLockedRate } from "./transaction-fx";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type { TodaySnapshot };

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

export async function stampOnboardingSaldoAt(): Promise<void> {
  await updateStore((s) => {
    if (s.profile.onboardingSaldoAt) return;
    const ts = nowIso();
    s.profile = { ...s.profile, onboardingSaldoAt: ts, updatedAt: ts };
  });
}

export async function stampOnboardingCompletedAt(): Promise<void> {
  await updateStore((s) => {
    if (s.profile.onboardingCompletedAt) return;
    const ts = nowIso();
    s.profile = { ...s.profile, onboardingCompletedAt: ts, updatedAt: ts };
  });
}

export async function stampGettingStartedCompletedAt(): Promise<void> {
  await updateStore((s) => {
    if (s.profile.gettingStartedCompletedAt) return;
    const ts = nowIso();
    s.profile = {
      ...s.profile,
      gettingStartedCompletedAt: ts,
      gettingStartedCollapsed: false,
      updatedAt: ts,
    };
  });
}

export async function setGettingStartedCollapsed(collapsed: boolean): Promise<void> {
  await updateStore((s) => {
    const ts = nowIso();
    s.profile = {
      ...s.profile,
      gettingStartedCollapsed: collapsed,
      updatedAt: ts,
    };
  });
}

export async function listAccounts(): Promise<Account[]> {
  const store = await readStore();
  return store.accounts.filter((a) => a.isActive);
}

export async function listArchivedAccounts(): Promise<Account[]> {
  const store = await readStore();
  return store.accounts.filter((a) => !a.isActive);
}

export async function getAccount(accountId: string): Promise<Account | null> {
  const store = await readStore();
  return store.accounts.find((a) => a.id === accountId) ?? null;
}

export async function ensureDefaultBankAccount(input?: {
  maskedIdentifier?: string | null;
  currency?: CurrencyCode;
}): Promise<Account> {
  const store = await readStore();
  const active = store.accounts.filter((a) => a.isActive);
  const wantedCurrency = input?.currency ?? "THB";
  const primary = active.find((a) => a.isDefault) ?? active[0] ?? null;
  if (primary) {
    if (primary.currency !== wantedCurrency) {
      const matching =
        active.find((a) => a.currency === wantedCurrency && a.accountType !== "cash") ??
        active.find((a) => a.currency === wantedCurrency) ??
        null;
      if (matching) return matching;
      return createAccount({
        name: wantedCurrency === "THB" ? "Bangkok Bank" : "Bankkonto",
        institution: wantedCurrency === "THB" ? "Bangkok Bank" : null,
        accountType: "checking",
        kind: wantedCurrency === "THB" ? "thai_bank" : "other",
        currency: wantedCurrency,
        maskedIdentifier: input?.maskedIdentifier ?? null,
        makeDefault: active.length === 0,
      });
    }
    if (
      input?.maskedIdentifier &&
      (!primary.maskedIdentifier || primary.maskedIdentifier === "")
    ) {
      await updateStore((s) => {
        const acc = s.accounts.find((a) => a.id === primary.id);
        if (acc) {
          acc.maskedIdentifier = input.maskedIdentifier!.trim();
          acc.updatedAt = nowIso();
        }
      });
      return (await getAccount(primary.id))!;
    }
    return primary;
  }

  return createAccount({
    name: wantedCurrency === "THB" ? "Bangkok Bank" : "Bankkonto",
    institution: wantedCurrency === "THB" ? "Bangkok Bank" : null,
    accountType: "checking",
    kind: wantedCurrency === "THB" ? "thai_bank" : "other",
    currency: wantedCurrency,
    maskedIdentifier: input?.maskedIdentifier ?? null,
    makeDefault: true,
  });
}

export async function ensureAccountForCurrency(input: {
  currency: CurrencyCode;
  name: string;
  institution?: string | null;
}): Promise<Account> {
  const existing = await listAccounts();
  const institution = input.institution?.trim() || null;

  if (institution) {
    const exact = existing.find(
      (a) =>
        a.currency === input.currency &&
        (a.institution ?? "").toLowerCase() === institution.toLowerCase(),
    );
    if (exact) return exact;
  } else {
    const any = existing.find((a) => a.currency === input.currency);
    if (any) return any;
  }

  if (input.currency === "THB" && !institution) {
    return ensureDefaultBankAccount({ currency: "THB" });
  }

  return createAccount({
    name: input.name,
    institution: institution ?? input.name,
    accountType: "checking",
    currency: input.currency,
    makeDefault: false,
  });
}

export async function createAccount(input: {
  name: string;
  institution?: string | null;
  accountType: Account["accountType"];
  kind?: AccountKind;
  currency: CurrencyCode;
  maskedIdentifier?: string | null;
  makeDefault?: boolean;
}): Promise<Account> {
  const kind = inferAccountKind({
    kind: input.kind,
    accountType: input.accountType,
    currency: input.currency,
    name: input.name,
    institution: input.institution,
  });
  assertCurrencyAllowedForKind(kind, input.currency);

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
      kind,
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

function localLifecycleFacts(store: NumaStoreData, account: Account) {
  return accountLifecycleFacts({
    account,
    actorUserId: LOCAL_DEMO_USER_ID,
    activeCount: store.accounts.filter((row) => row.isActive).length,
    transactions: store.transactions.filter((tx) => tx.accountId === account.id),
    checkpoint: latestCheckpointForAccount(store, account.id),
  });
}

export async function updateAccount(input: {
  id: string;
  name?: string;
  kind?: AccountKind;
  currency?: CurrencyCode;
  makeDefault?: boolean;
}): Promise<Account> {
  const store = await readStore();
  const account = store.accounts.find((row) => row.id === input.id) ?? null;
  if (!account) throw new Error("Kontot hittades inte");
  const facts = localLifecycleFacts(store, account);
  requireLifecycle(assertAccountAcceptsWrites(account));

  const nextKind = input.kind ?? account.kind;
  const nextCurrency = input.currency ?? account.currency;
  if (input.kind != null && input.kind !== account.kind) {
    requireLifecycle(evaluateKindChange(facts, input.kind, nextCurrency));
  }
  if (input.currency != null && input.currency !== account.currency) {
    requireLifecycle(evaluateCurrencyChange(facts, nextKind, input.currency));
  }
  if (input.makeDefault === false && account.isDefault) {
    throw new Error(
      "Välj ett annat förvalt konto först. Förvalt konto kan inte lämnas utan ersättare.",
    );
  }

  const updated = await updateStore((s) => {
    const row = s.accounts.find((item) => item.id === input.id);
    if (!row) throw new Error("Kontot hittades inte");
    const ts = nowIso();
    if (input.name != null) row.name = input.name.trim();
    if (input.kind != null) {
      row.kind = input.kind;
      row.accountType = accountTypeForKind(input.kind, row.accountType);
    }
    if (input.currency != null && input.currency !== row.currency) {
      row.currency = input.currency;
      const latest = latestCheckpointForAccount(s, row.id);
      if (latest) {
        latest.currency = input.currency;
        if (input.currency === "THB") {
          latest.thbMinor = latest.balanceMinor;
          latest.fxRate = 1;
          latest.fxSource = "identity";
        } else {
          latest.thbMinor = null;
          latest.fxRate = null;
          latest.fxSource = null;
        }
      }
    }
    if (input.makeDefault) {
      for (const item of s.accounts) item.isDefault = item.id === row.id;
    }
    row.updatedAt = ts;
  });
  const next = updated.accounts.find((row) => row.id === input.id);
  if (!next) throw new Error("Kontot hittades inte");
  return next;
}

export async function deleteAccount(id: string): Promise<void> {
  const store = await readStore();
  const account = store.accounts.find((row) => row.id === id) ?? null;
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(evaluateDeleteAccount(localLifecycleFacts(store, account)));
  await updateStore((s) => {
    s.accounts = s.accounts.filter((row) => row.id !== id);
    s.checkpoints = s.checkpoints.filter((row) => row.accountId !== id);
  });
}

export async function archiveAccount(id: string): Promise<Account> {
  const store = await readStore();
  const account = store.accounts.find((row) => row.id === id) ?? null;
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(evaluateArchiveAccount(localLifecycleFacts(store, account)));
  const updated = await updateStore((s) => {
    const row = s.accounts.find((item) => item.id === id);
    if (!row) throw new Error("Kontot hittades inte");
    row.isActive = false;
    row.isDefault = false;
    row.updatedAt = nowIso();
  });
  const next = updated.accounts.find((row) => row.id === id);
  if (!next) throw new Error("Kontot hittades inte");
  return next;
}

export async function restoreAccount(id: string): Promise<Account> {
  const store = await readStore();
  const account = store.accounts.find((row) => row.id === id) ?? null;
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(evaluateRestoreAccount(localLifecycleFacts(store, account)));
  const updated = await updateStore((s) => {
    const row = s.accounts.find((item) => item.id === id);
    if (!row) throw new Error("Kontot hittades inte");
    row.isActive = true;
    row.updatedAt = nowIso();
  });
  const next = updated.accounts.find((row) => row.id === id);
  if (!next) throw new Error("Kontot hittades inte");
  return next;
}

export async function createCheckpoint(input: {
  accountId: string;
  balanceMinor: number;
  verifiedAt?: string;
  source: string;
  note?: string | null;
  fxRate?: number | null;
  fxAsOf?: string | null;
  fxSource?: string | null;
  requireFx?: boolean;
}): Promise<BalanceCheckpoint> {
  const store = await readStore();
  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(account));

  const fx = await resolveCheckpointFx({
    currency: account.currency,
    balanceMinor: input.balanceMinor,
    fxRate: input.fxRate,
    fxAsOf: input.fxAsOf,
    fxSource: input.fxSource,
    required: input.requireFx,
  });

  const updated = await updateStore((s) => {
    const ts = nowIso();
    const checkpoint: BalanceCheckpoint = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: input.accountId,
      balanceMinor: input.balanceMinor,
      currency: account.currency,
      thbMinor: fx?.thbMinor ?? null,
      fxRate: fx?.fxRate ?? null,
      fxAsOf: fx?.fxAsOf ?? null,
      fxSource: fx?.fxSource ?? null,
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

export async function listKnownFingerprints(options?: {
  includePendingCandidates?: boolean;
}): Promise<string[]> {
  const store = await readStore();
  const fromTx = store.transactions
    .filter(
      (t) => t.userId === LOCAL_DEMO_USER_ID && t.fingerprint && t.status === "confirmed",
    )
    .map((t) => t.fingerprint!);
  const pending = options?.includePendingCandidates !== false;
  const fromCandidates = store.candidates
    .filter((c) => {
      if (c.userId !== LOCAL_DEMO_USER_ID || !c.fingerprint) return false;
      if (c.status === "confirmed" || c.status === "duplicate") return true;
      return pending && c.status === "needs_review";
    })
    .map((c) => c.fingerprint!);
  return [...new Set([...fromTx, ...fromCandidates])];
}

/** Confirmed ledger only — used when writing a transaction. */
export async function listConfirmedFingerprints(): Promise<string[]> {
  return listKnownFingerprints({ includePendingCandidates: false });
}

export async function supersedePendingCandidatesByFingerprints(
  fingerprints: string[],
): Promise<number> {
  const fps = [...new Set(fingerprints.map((f) => f.trim()).filter(Boolean))];
  if (fps.length === 0) return 0;
  let count = 0;
  await updateStore((s) => {
    const ts = nowIso();
    for (const c of s.candidates) {
      if (
        c.userId === LOCAL_DEMO_USER_ID &&
        c.fingerprint &&
        fps.includes(c.fingerprint) &&
        (c.status === "needs_review" || c.status === "pending")
      ) {
        c.status = "rejected";
        c.updatedAt = ts;
        count += 1;
      }
    }
  });
  return count;
}

export async function createManualExpense(input: {
  accountId: string;
  amountMinor: number;
  description?: string;
  category?: string | null;
  occurredAt?: string;
  source?: TransactionSource;
  sourceObservationId?: string | null;
  merchant?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
  planItemId?: string | null;
  ledgerOrigin?: CanonicalTransaction["ledgerOrigin"];
  linkedPlanItemId?: string | null;
  clientMutationId?: string | null;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }

  const store = await readStore();
  if (input.clientMutationId) {
    const existing = store.transactions.find(
      (t) => t.clientMutationId === input.clientMutationId,
    );
    if (existing) return existing;
  }
  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(account));
  if (
    input.sourceObservationId &&
    !store.observations.some(
      (o) => o.id === input.sourceObservationId && o.userId === LOCAL_DEMO_USER_ID,
    )
  ) {
    throw new Error("Importen hittades inte");
  }

  if (input.fingerprint) {
    const known = await listConfirmedFingerprints();
    if (known.includes(input.fingerprint)) {
      throw new Error("Den här bankbetalningen finns redan");
    }
  }
  if (input.planItemId) {
    const clash = store.transactions.find(
      (t) =>
        t.planItemId === input.planItemId &&
        t.status === "confirmed" &&
        t.userId === LOCAL_DEMO_USER_ID,
    );
    if (clash) throw new Error("Den här planposten är redan bokad mot saldot");
  }

  const updated = await updateStore((s) => {
    const ts = nowIso();
    const checkpoint = latestCheckpointForAccount(s, input.accountId);
    const fx = fxFieldsForWrite({
      nativeMinor: input.amountMinor,
      currency: account.currency,
      checkpoint,
      nowIso: ts,
    });
    const tx: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: input.accountId,
      counterAccountId: null,
      direction: "debit",
      transactionType: "expense",
      amountMinor: input.amountMinor,
      currency: account.currency,
      thbMinor: fx.thbMinor,
      fxRate: fx.fxRate,
      fxAsOf: fx.fxAsOf,
      fxSource: fx.fxSource,
      clientMutationId: input.clientMutationId ?? null,
      occurredAt: input.occurredAt ?? ts,
      description: input.description?.trim() || "Utgift",
      merchant: input.merchant ?? null,
      category: input.category ?? null,
      source: input.source ?? "manual",
      status: "confirmed",
      balanceAfterMinor: input.balanceAfterMinor ?? null,
      fingerprint: input.fingerprint ?? null,
      sourceObservationId: input.sourceObservationId ?? null,
      transferGroupId: null,
      planItemId: input.planItemId ?? null,
      ledgerOrigin:
        input.ledgerOrigin ?? (input.planItemId ? "plan_settle" : "external"),
      linkedPlanItemId: input.linkedPlanItemId ?? null,
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
  source?: TransactionSource;
  sourceObservationId?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
  planItemId?: string | null;
  ledgerOrigin?: CanonicalTransaction["ledgerOrigin"];
  linkedPlanItemId?: string | null;
  clientMutationId?: string | null;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  const store = await readStore();
  if (input.clientMutationId) {
    const existing = store.transactions.find(
      (t) => t.clientMutationId === input.clientMutationId,
    );
    if (existing) return existing;
  }
  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(account));

  if (input.fingerprint) {
    const known = await listConfirmedFingerprints();
    if (known.includes(input.fingerprint)) {
      throw new Error("Den här bankrörelsen finns redan");
    }
  }
  if (input.planItemId) {
    const clash = store.transactions.find(
      (t) =>
        t.planItemId === input.planItemId &&
        t.status === "confirmed" &&
        t.userId === LOCAL_DEMO_USER_ID,
    );
    if (clash) throw new Error("Den här planposten är redan bokad mot saldot");
  }

  const updated = await updateStore((s) => {
    const ts = nowIso();
    const checkpoint = latestCheckpointForAccount(s, input.accountId);
    const fx = fxFieldsForWrite({
      nativeMinor: input.amountMinor,
      currency: account.currency,
      checkpoint,
      nowIso: ts,
    });
    const tx: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: input.accountId,
      counterAccountId: null,
      direction: "credit",
      transactionType: "income",
      amountMinor: input.amountMinor,
      currency: account.currency,
      thbMinor: fx.thbMinor,
      fxRate: fx.fxRate,
      fxAsOf: fx.fxAsOf,
      fxSource: fx.fxSource,
      clientMutationId: input.clientMutationId ?? null,
      occurredAt: input.occurredAt ?? ts,
      description: input.description?.trim() || "Insättning",
      merchant: null,
      category: null,
      source: input.source ?? "manual",
      status: "confirmed",
      balanceAfterMinor: input.balanceAfterMinor ?? null,
      fingerprint: input.fingerprint ?? null,
      sourceObservationId: input.sourceObservationId ?? null,
      transferGroupId: null,
      planItemId: input.planItemId ?? null,
      ledgerOrigin:
        input.ledgerOrigin ?? (input.planItemId ? "plan_settle" : "external"),
      linkedPlanItemId: input.linkedPlanItemId ?? null,
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
  requireLifecycle(assertAccountAcceptsWrites(from));
  requireLifecycle(assertAccountAcceptsWrites(to));
  if (from.currency !== to.currency) {
    throw new Error("Överföring mellan olika valutor kräver FX (ej i fas 0)");
  }

  let outId = "";
  let inId = "";
  await updateStore((s) => {
    const ts = nowIso();
    const occurredAt = input.occurredAt ?? ts;
    const description = input.description?.trim() || "Överföring";
    const transferGroupId = newId();

    const checkpoint = latestCheckpointForAccount(s, from.id);
    const fx = fxFieldsForWrite({
      nativeMinor: input.amountMinor,
      currency: from.currency,
      checkpoint,
      nowIso: ts,
    });
    const out: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: from.id,
      counterAccountId: to.id,
      direction: "debit",
      transactionType: "transfer",
      amountMinor: input.amountMinor,
      currency: from.currency,
      thbMinor: fx.thbMinor,
      fxRate: fx.fxRate,
      fxAsOf: fx.fxAsOf,
      fxSource: fx.fxSource,
      occurredAt,
      description,
      merchant: null,
      category: null,
      source: "manual",
      status: "confirmed",
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      transferGroupId,
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

export async function createCashWithdrawal(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<{ out: CanonicalTransaction; inn: CanonicalTransaction }> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  if (!input.toAccountId) {
    throw new Error("Välj ett kontantkonto — annars försvinner pengarna i modellen");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Välj två olika konton");
  }

  const store = await readStore();
  const from = store.accounts.find((a) => a.id === input.fromAccountId);
  if (!from) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(from));
  const to = store.accounts.find((a) => a.id === input.toAccountId);
  if (!to) throw new Error("Kontantkontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(to));
  if (to.accountType !== "cash") {
    throw new Error("Kontantuttag måste gå till ett konto av typen Kontanter");
  }
  if (from.currency !== to.currency) {
    throw new Error("Olika valutor stöds inte ännu");
  }

  let outId = "";
  let inId = "";
  await updateStore((s) => {
    const ts = nowIso();
    const occurredAt = input.occurredAt ?? ts;
    const description = input.description?.trim() || "Kontantuttag";
    const transferGroupId = newId();
    const checkpoint = latestCheckpointForAccount(s, from.id);
    const fx = fxFieldsForWrite({
      nativeMinor: input.amountMinor,
      currency: from.currency,
      checkpoint,
      nowIso: ts,
    });
    const out: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: from.id,
      counterAccountId: to.id,
      direction: "debit",
      transactionType: "cash_withdrawal",
      amountMinor: input.amountMinor,
      currency: from.currency,
      thbMinor: fx.thbMinor,
      fxRate: fx.fxRate,
      fxAsOf: fx.fxAsOf,
      fxSource: fx.fxSource,
      occurredAt,
      description,
      merchant: null,
      category: null,
      source: "manual",
      status: "confirmed",
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      transferGroupId,
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

export async function listTransactions(
  accountId?: string,
): Promise<CanonicalTransaction[]> {
  const store = await readStore();
  return store.transactions
    .filter((t) => (accountId ? t.accountId === accountId : true))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function listTransactionsByPlanItemId(
  planItemId: string,
): Promise<CanonicalTransaction[]> {
  const store = await readStore();
  return store.transactions
    .filter(
      (t) =>
        t.planItemId === planItemId &&
        t.status !== "voided" &&
        t.userId === LOCAL_DEMO_USER_ID,
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function listConfirmedPlanSettleLedgers(): Promise<
  CanonicalTransaction[]
> {
  const store = await readStore();
  return store.transactions.filter(
    (t) =>
      t.userId === LOCAL_DEMO_USER_ID &&
      t.status === "confirmed" &&
      Boolean(t.planItemId),
  );
}

export async function updateTransaction(input: {
  id: string;
  amountMinor?: number;
  description?: string;
  category?: string | null;
  occurredAt?: string;
}): Promise<CanonicalTransaction> {
  let found: CanonicalTransaction | null = null;
  await updateStore((s) => {
    const tx = s.transactions.find(
      (t) => t.id === input.id && t.userId === LOCAL_DEMO_USER_ID,
    );
    if (!tx) throw new Error("Rörelsen hittades inte");
    if (tx.status === "voided") throw new Error("Borttagen rörelse kan inte ändras");
    if (input.amountMinor != null) {
      if (input.amountMinor <= 0) throw new Error("Beloppet måste vara större än noll");
      const fx = recomputeThbFromLockedRate({
        nativeMinor: input.amountMinor,
        currency: tx.currency,
        fxRate: tx.fxRate,
        nowIso: nowIso(),
      });
      tx.amountMinor = input.amountMinor;
      tx.thbMinor = fx.thbMinor;
      tx.fxRate = fx.fxRate;
      tx.fxAsOf = fx.fxAsOf;
      tx.fxSource = fx.fxSource;
    }
    if (input.description != null) {
      tx.description = input.description.trim() || tx.description;
    }
    if (input.category !== undefined) tx.category = input.category;
    if (input.occurredAt != null) tx.occurredAt = input.occurredAt;
    tx.updatedAt = nowIso();
    found = tx;
  });
  return found!;
}

export async function voidTransaction(id: string): Promise<CanonicalTransaction> {
  let found: CanonicalTransaction | null = null;
  await updateStore((s) => {
    const tx = s.transactions.find((t) => t.id === id && t.userId === LOCAL_DEMO_USER_ID);
    if (!tx) throw new Error("Rörelsen hittades inte");

    const ids = collectPairedVoidIds(
      {
        id: tx.id,
        transactionType: tx.transactionType,
        accountId: tx.accountId,
        counterAccountId: tx.counterAccountId,
        amountMinor: tx.amountMinor,
        occurredAt: tx.occurredAt,
        transferGroupId: tx.transferGroupId ?? null,
        status: tx.status,
      },
      s.transactions
        .filter((t) => t.userId === LOCAL_DEMO_USER_ID)
        .map((t) => ({
          id: t.id,
          transactionType: t.transactionType,
          accountId: t.accountId,
          counterAccountId: t.counterAccountId,
          amountMinor: t.amountMinor,
          occurredAt: t.occurredAt,
          transferGroupId: t.transferGroupId ?? null,
          status: t.status,
        })),
    );

    const ts = nowIso();
    for (const voidId of ids) {
      const row = s.transactions.find((t) => t.id === voidId);
      if (!row || row.status === "voided") continue;
      row.status = "voided";
      row.updatedAt = ts;
    }
    found = s.transactions.find((t) => t.id === id) ?? null;
  });
  if (!found) throw new Error("Rörelsen hittades inte");
  return found;
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

export async function deleteObservation(observationId: string): Promise<void> {
  await updateStore((s) => {
    s.observations = s.observations.filter((o) => o.id !== observationId);
    s.candidates = s.candidates.filter((c) => c.observationId !== observationId);
  });
}

export async function getObservation(
  observationId: string,
): Promise<SourceObservation | null> {
  const store = await readStore();
  return store.observations.find((o) => o.id === observationId) ?? null;
}

export async function listObservationCandidates(
  observationId: string,
): Promise<ExtractedTransactionCandidate[]> {
  const store = await readStore();
  return store.candidates.filter(
    (c) => c.userId === LOCAL_DEMO_USER_ID && c.observationId === observationId,
  );
}

export async function getObservationMediaUrl(
  storagePath: string,
): Promise<string | null> {
  assertUserOwnsStoragePath(LOCAL_DEMO_USER_ID, storagePath);
  return `/api/numa-media?p=${encodeURIComponent(storagePath)}`;
}

/** Dev-only in-memory progress (single tenant). */
const localProgress = new Map<string, UserProgress>();
const localProgressDays = new Set<string>();

export async function getUserProgress(): Promise<UserProgress | null> {
  return localProgress.get(LOCAL_DEMO_USER_ID) ?? emptyUserProgress(LOCAL_DEMO_USER_ID);
}

export async function recordOnTrackDayIfNeeded(
  isOnTrack: boolean,
): Promise<UserProgress | null> {
  if (!isOnTrack) return getUserProgress();
  const store = await readStore();
  const dayKey = zonedDayKey(new Date(), store.profile.timezone);
  const key = `${LOCAL_DEMO_USER_ID}:${dayKey}`;
  if (localProgressDays.has(key)) return getUserProgress();
  localProgressDays.add(key);

  const current =
    localProgress.get(LOCAL_DEMO_USER_ID) ?? emptyUserProgress(LOCAL_DEMO_USER_ID);
  const onTrackDays = current.onTrackDays + 1;
  const currentStreak = current.currentStreak + 1;
  const rank = rankForOnTrackDays(onTrackDays);
  const next: UserProgress = {
    ...current,
    onTrackDays,
    currentStreak,
    bestStreak: Math.max(current.bestStreak, currentStreak),
    disciplineScore: current.disciplineScore + 10,
    level: rank.minLevel,
    rankId: rank.id,
    updatedAt: nowIso(),
  };
  localProgress.set(LOCAL_DEMO_USER_ID, next);
  return next;
}

export async function uploadReceiptAndExtract(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  preferBankSms?: boolean;
  preferBankApp?: boolean;
}): Promise<ReceiptUploadResult> {
  const storagePath = buildUserStoragePath(LOCAL_DEMO_USER_ID, input.fileName);
  assertUserOwnsStoragePath(LOCAL_DEMO_USER_ID, storagePath);

  try {
    const dir = path.join(process.cwd(), ".data", "media", LOCAL_DEMO_USER_ID);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(process.cwd(), ".data", "media", storagePath), input.bytes);
  } catch {
    // Vercel/read-only: keep metadata-only path.
  }

  const observationId = newId();
  const runId = newId();
  const provider = createExtractionProvider();
  const imageBase64 = Buffer.from(input.bytes).toString("base64");
  const institutionHint = input.preferBankSms
    ? "Bangkok Bank"
    : input.preferBankApp
      ? "bank_app"
      : null;
  const extraction = await provider.extract({
    observationId,
    storagePath,
    imageBase64,
    mimeType: input.mimeType,
    institutionHint,
  });

  const known = await listConfirmedFingerprints();
  const resolved = resolveScreenshotImport(extraction, known, {
    preferBankSms: input.preferBankSms,
    preferBankApp: input.preferBankApp,
  });
  const ts = nowIso();
  const createdCandidates: ExtractedTransactionCandidate[] = [];

  const batch =
    (resolved.kind === "bank_sms" || resolved.kind === "bank_app") &&
    !resolved.alreadyKnown
      ? resolved.selectedBatch
      : [];
  const hasBatch = batch.length > 0;
  const hasSingle =
    !hasBatch && resolved.suggestedAmountMinor != null && !resolved.alreadyKnown;

  if (hasBatch) {
    await supersedePendingCandidatesByFingerprints(
      batch.map((e) => e.fingerprint?.fingerprint).filter((f): f is string => Boolean(f)),
    );
  } else if (hasSingle && resolved.fingerprint) {
    await supersedePendingCandidatesByFingerprints([resolved.fingerprint]);
  }

  const importKindTag =
    resolved.kind === "bank_sms"
      ? "bank_sms"
      : resolved.kind === "bank_app"
        ? "bank_app"
        : resolved.kind;

  await updateStore((s) => {
    const observation: SourceObservation = {
      id: observationId,
      userId: LOCAL_DEMO_USER_ID,
      kind: resolved.observationKind,
      storagePath,
      institutionHint:
        resolved.kind === "bank_sms"
          ? "Bangkok Bank"
          : resolved.kind === "bank_app"
            ? (resolved.selected?.institution ?? "bank_app")
            : null,
      accountHint:
        resolved.kind === "bank_sms"
          ? (resolved.selected?.maskedAccount ??
            (batch[0] && "maskedAccount" in batch[0] ? batch[0].maskedAccount : null) ??
            null)
          : null,
      status: resolved.alreadyKnown
        ? "processed"
        : hasBatch || hasSingle
          ? "needs_review"
          : "uploaded",
      capturedAt: ts,
      notes: resolved.messageSv,
      createdAt: ts,
      updatedAt: ts,
    };
    s.observations.push(observation);

    const run: ExtractionRun = {
      id: runId,
      observationId,
      userId: LOCAL_DEMO_USER_ID,
      provider: extraction.provider,
      status: extraction.provider === "none" ? "failed" : "succeeded",
      rawMetadata: {
        ...extraction.rawMetadata,
        resolvedKind: resolved.kind,
        alreadyKnown: resolved.alreadyKnown,
        tipBalanceAfterMinor:
          resolved.kind === "bank_sms" ? resolved.balanceAfterMinor : null,
      },
      startedAt: ts,
      finishedAt: ts,
    };
    s.extractionRuns.push(run);

    if (hasBatch) {
      batch.forEach((event, batchIndex) => {
        if (event.amountMinor == null || !event.direction || !event.fingerprint) {
          return;
        }
        const cand: ExtractedTransactionCandidate = {
          id: newId(),
          extractionRunId: runId,
          observationId,
          userId: LOCAL_DEMO_USER_ID,
          direction: event.direction,
          amountMinor: event.amountMinor,
          currency: event.currency ?? "THB",
          balanceAfterMinor:
            "balanceAfterMinor" in event ? event.balanceAfterMinor : null,
          occurredAt:
            "occurredAt" in event && typeof event.occurredAt === "string"
              ? event.occurredAt
              : null,
          description: event.labelSv,
          confidence: event.confidence,
          fingerprint: event.fingerprint.fingerprint,
          status: "needs_review",
          canonicalTransactionId: null,
          rawPayload: {
            importKind: importKindTag,
            labelSv: event.labelSv,
            batchIndex,
            tipBalanceAfterMinor:
              resolved.kind === "bank_sms" ? resolved.balanceAfterMinor : null,
            updatesBalance:
              resolved.kind === "bank_sms" && resolved.balanceAfterMinor != null,
            merchant:
              "merchant" in event && typeof event.merchant === "string"
                ? event.merchant
                : null,
            accountInstitution: "institution" in event ? String(event.institution) : null,
            accountName:
              "institution" in event
                ? event.institution === "bunq"
                  ? "bunq"
                  : event.institution === "revolut"
                    ? "Revolut"
                    : "Bankapp"
                : null,
            annotationSv:
              "annotationSv" in event && typeof event.annotationSv === "string"
                ? event.annotationSv
                : null,
          },
          createdAt: ts,
          updatedAt: ts,
        };
        s.candidates.push(cand);
        createdCandidates.push(cand);
      });
    } else if (hasSingle) {
      const cand: ExtractedTransactionCandidate = {
        id: newId(),
        extractionRunId: runId,
        observationId,
        userId: LOCAL_DEMO_USER_ID,
        direction: resolved.direction,
        amountMinor: resolved.suggestedAmountMinor,
        currency: resolved.currency,
        balanceAfterMinor: resolved.balanceAfterMinor,
        occurredAt: null,
        description: resolved.suggestedDescription,
        confidence:
          resolved.kind === "bank_sms" || resolved.kind === "bank_app"
            ? (resolved.selected?.confidence ?? null)
            : (extraction.candidates[0]?.confidence ??
              (typeof extraction.rawMetadata?.confidence === "number"
                ? extraction.rawMetadata.confidence
                : null)),
        fingerprint: resolved.fingerprint,
        status: "needs_review",
        canonicalTransactionId: null,
        rawPayload: {
          importKind: importKindTag,
          labelSv: resolved.suggestedDescription,
          batchIndex: 0,
          suggestedAmountMinor: resolved.suggestedAmountMinor,
        },
        createdAt: ts,
        updatedAt: ts,
      };
      s.candidates.push(cand);
      createdCandidates.push(cand);
    }
  });

  const observation = (await getObservation(observationId))!;
  const profile = (await readStore()).profile;
  const candidate = createdCandidates[0] ?? null;
  let ocrStatus: ReceiptUploadResult["ocrStatus"] = "ok";
  if (extraction.provider === "none") ocrStatus = "unavailable";
  else if (resolved.alreadyKnown) ocrStatus = "all_known";
  else if (createdCandidates.length === 0) ocrStatus = "failed";

  const confidence =
    candidate?.confidence ??
    (typeof extraction.rawMetadata?.confidence === "number"
      ? extraction.rawMetadata.confidence
      : null);

  if (
    ocrStatus === "ok" &&
    resolved.kind === "bank_sms" &&
    confidence != null &&
    confidence < 0.55
  ) {
    ocrStatus = "failed";
  }

  const skippedOlderCount =
    (resolved.kind === "bank_sms" || resolved.kind === "bank_app") &&
    resolved.selection.status === "ready"
      ? resolved.selection.skippedDuplicateCount
      : 0;

  const events = createdCandidates
    .filter(
      (c) =>
        c.amountMinor != null &&
        c.direction &&
        c.fingerprint &&
        (c.direction === "debit" || c.direction === "credit"),
    )
    .map((c) => ({
      candidateId: c.id,
      direction: c.direction as "debit" | "credit",
      amountMinor: c.amountMinor!,
      balanceAfterMinor: c.balanceAfterMinor,
      fingerprint: c.fingerprint!,
      description: c.description ?? "",
      labelSv:
        typeof c.rawPayload?.labelSv === "string"
          ? c.rawPayload.labelSv
          : (c.description ?? ""),
    }));

  const visionMessage =
    typeof extraction.rawMetadata?.message === "string"
      ? extraction.rawMetadata.message
      : null;

  return {
    observation,
    candidate,
    events,
    suggestedAmountMinor: resolved.suggestedAmountMinor,
    suggestedDescription: resolved.suggestedDescription,
    currency: resolved.currency ?? profile.primaryCurrency,
    ocrStatus,
    confidence,
    message:
      ocrStatus === "unavailable"
        ? "Autoläsning är inte konfigurerad (OPENAI_API_KEY saknas i miljön)."
        : ocrStatus === "failed"
          ? (visionMessage ??
            resolved.messageSv ??
            "Kunde inte läsa bilden — ta en skarpare skärmdump.")
          : resolved.messageSv,
    importKind:
      resolved.kind === "bank_sms"
        ? "bank_sms"
        : resolved.kind === "bank_app"
          ? "bank_app"
          : resolved.kind === "receipt_or_other"
            ? "receipt"
            : "unknown",
    balanceAfterMinor: resolved.balanceAfterMinor,
    fingerprint: resolved.fingerprint,
    alreadyKnown: resolved.alreadyKnown,
    skippedOlderCount,
    direction: resolved.direction,
  };
}

export async function confirmReceiptExpense(
  input: ConfirmReceiptInput,
): Promise<CanonicalTransaction> {
  const store = await readStore();
  const observation = store.observations.find(
    (o) => o.id === input.observationId && o.userId === LOCAL_DEMO_USER_ID,
  );
  if (!observation) throw new Error("Importen hittades inte");

  const batchMode = input.confirmAllPending === true || observation.kind === "screenshot";

  if (batchMode) {
    const allCandidates = store.candidates.filter(
      (c) => c.userId === LOCAL_DEMO_USER_ID && c.observationId === input.observationId,
    );
    const pending = allCandidates
      .filter(
        (c) =>
          c.status === "needs_review" &&
          c.amountMinor != null &&
          c.amountMinor > 0 &&
          (c.direction === "credit" || c.direction === "debit") &&
          c.fingerprint,
      )
      .sort((a, b) => {
        const ai =
          typeof a.rawPayload?.batchIndex === "number" ? a.rawPayload.batchIndex : 0;
        const bi =
          typeof b.rawPayload?.batchIndex === "number" ? b.rawPayload.batchIndex : 0;
        return ai - bi;
      });

    const linked = store.transactions
      .filter(
        (t) =>
          t.userId === LOCAL_DEMO_USER_ID &&
          t.sourceObservationId === input.observationId &&
          t.status !== "voided",
      )
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

    const decision = decideSmsBatchConfirm({
      pendingCandidateIds: pending.map((c) => c.id),
      confirmedCanonicalIds: allCandidates
        .filter((c) => c.status === "confirmed")
        .map((c) => c.canonicalTransactionId),
      linkedTransactionIds: linked.map((t) => t.id),
    });

    if (decision.action === "idempotent") {
      const existing =
        linked.find((t) => t.id === decision.existingTransactionId) ??
        store.transactions.find((t) => t.id === decision.existingTransactionId);
      if (existing) return existing;
    }

    if (decision.action === "empty") {
      throw new Error("Inga bankrörelser att spara från den här bilden");
    }

    const payloadTip = pending
      .map((c) => c.rawPayload?.tipBalanceAfterMinor)
      .find((v): v is number => typeof v === "number");
    const updatesFlag = pending
      .map((c) => c.rawPayload?.updatesBalance)
      .find((v): v is boolean => typeof v === "boolean");
    const tipInBatch =
      updatesFlag === true || (updatesFlag == null && input.balanceAfterMinor != null);
    const tipBalance = resolveSmsTipBalanceMinor({
      inputBalanceAfterMinor: input.balanceAfterMinor,
      payloadTipBalanceMinor: payloadTip ?? null,
      updatesBalance: tipInBatch,
    });

    const maskedFromCandidate = input.maskedAccount ?? observation.accountHint ?? null;

    const batchCurrency = (pending[0]?.currency as CurrencyCode | null) ?? "THB";
    const isBankAppBatch = pending.some((c) => c.rawPayload?.importKind === "bank_app");
    const institutionHint =
      typeof pending[0]?.rawPayload?.accountInstitution === "string"
        ? pending[0].rawPayload.accountInstitution
        : observation.institutionHint;

    const accountFromInput = input.accountId ? await getAccount(input.accountId) : null;
    // Bank-app EUR must not land on Hem's THB account just because UI passed it.
    const account =
      accountFromInput && (!isBankAppBatch || accountFromInput.currency === batchCurrency)
        ? accountFromInput
        : isBankAppBatch
          ? await ensureAccountForCurrency({
              currency: batchCurrency,
              name:
                typeof pending[0]?.rawPayload?.accountName === "string"
                  ? pending[0].rawPayload.accountName
                  : institutionHint || "Bankapp",
              institution: institutionHint,
            })
          : await ensureDefaultBankAccount({
              maskedIdentifier: maskedFromCandidate,
              currency: "THB",
            });

    if (isBankAppBatch) {
      if (account.currency !== batchCurrency) {
        throw new Error(
          `Kontovaluta (${account.currency}) matchar inte importen (${batchCurrency})`,
        );
      }
    } else {
      if (account.currency !== "THB") {
        throw new Error(
          "Bank-SMS är i THB — välj eller skapa ett THB-konto innan du sparar",
        );
      }
    }

    const known = await listConfirmedFingerprints();
    const chronological = [...pending].reverse();
    const fresh = chronological.filter((c) => !known.includes(c.fingerprint!));

    if (fresh.length === 0) {
      const lastLinked = linked[linked.length - 1];
      if (lastLinked) return lastLinked;
      throw new Error("Den här bankrörelsen finns redan");
    }

    // Validate first-import tip before mutating.
    const pre = await readStore();
    const hadCheckpoint = latestCheckpointForAccount(pre, account.id) != null;
    if (!hadCheckpoint && tipBalance == null) {
      if (!(isBankAppBatch && account.currency !== "THB")) {
        throw new Error(
          isBankAppBatch
            ? "Första importen måste vara ett bank-SMS med saldo — bankapp-bilder fungerar efteråt."
            : "Första importen måste vara ett bank-SMS med saldo (available balance)",
        );
      }
    }

    if (
      isBankAppBatch &&
      !hadCheckpoint &&
      account.currency !== "THB" &&
      tipBalance == null
    ) {
      const earliestMs = fresh.reduce((min, c) => {
        if (typeof c.occurredAt !== "string" || !c.occurredAt) return min;
        const t = Date.parse(c.occurredAt);
        return Number.isFinite(t) ? Math.min(min, t) : min;
      }, Date.now());
      await createCheckpoint({
        accountId: account.id,
        balanceMinor: 0,
        verifiedAt: new Date(earliestMs - 60_000).toISOString(),
        source: "bank_app_bootstrap",
        note: `Startsaldo 0 ${account.currency} — justera under Konton om du vet verkligt saldo`,
        requireFx: false,
      });
    }

    const baseMs = Date.now();
    let lastTxId = "";
    const ledgerSource: TransactionSource = isBankAppBatch ? "bank_import" : "screenshot";
    const tipInBatchEffective =
      tipInBatch && tipBalance != null && account.currency === "THB";

    await updateStore((s) => {
      const ts = nowIso();
      const created: CanonicalTransaction[] = [];

      for (let i = 0; i < fresh.length; i++) {
        const cand = fresh[i]!;
        const direction = cand.direction as "debit" | "credit";
        const movedAt = resolveSmsBatchOccurredAt({
          candidateOccurredAt: cand.occurredAt,
          index: i,
          batchLength: fresh.length,
          baseMs,
          tipInBatch: tipInBatchEffective || isBankAppBatch,
        });
        const tx: CanonicalTransaction = {
          id: newId(),
          userId: LOCAL_DEMO_USER_ID,
          accountId: account.id,
          counterAccountId: null,
          direction,
          transactionType: direction === "credit" ? "income" : "expense",
          amountMinor: cand.amountMinor!,
          currency: account.currency,
          occurredAt: movedAt,
          description:
            cand.description ||
            (direction === "credit"
              ? isBankAppBatch
                ? "Insättning (import)"
                : "Insättning (bank-SMS)"
              : isBankAppBatch
                ? "Utgift (import)"
                : "Utgift (bank-SMS)"),
          merchant: null,
          category: direction === "debit" ? (input.category ?? null) : null,
          source: ledgerSource,
          status: "confirmed",
          balanceAfterMinor: cand.balanceAfterMinor ?? null,
          fingerprint: cand.fingerprint ?? null,
          sourceObservationId: input.observationId,
          transferGroupId: null,
          syncStatus: "saved",
          createdAt: ts,
          updatedAt: ts,
        };
        created.push(tx);
        s.transactions.push(tx);

        const row = s.candidates.find((c) => c.id === cand.id);
        if (row) {
          row.status = "confirmed";
          row.canonicalTransactionId = tx.id;
          row.updatedAt = ts;
        }
      }

      lastTxId = created[created.length - 1]!.id;

      if (
        shouldWriteSmsTipCheckpoint({
          tipBalanceMinor: tipBalance,
          tipInBatch: tipInBatchEffective,
        })
      ) {
        const checkpoint: BalanceCheckpoint = {
          id: newId(),
          userId: LOCAL_DEMO_USER_ID,
          accountId: account.id,
          balanceMinor: tipBalance!,
          currency: account.currency,
          thbMinor: tipBalance!,
          fxRate: 1,
          fxAsOf: new Date(baseMs).toISOString(),
          fxSource: "identity",
          verifiedAt: new Date(baseMs).toISOString(),
          source: hadCheckpoint ? "sms_import" : "sms_bootstrap",
          sourceObservationId: null,
          note: hadCheckpoint
            ? "Saldo från Bangkok Bank SMS"
            : "Första saldo från Bangkok Bank SMS",
          createdAt: ts,
        };
        s.checkpoints.push(checkpoint);
      }

      const obs = s.observations.find((o) => o.id === input.observationId);
      if (obs) {
        obs.status = "processed";
        obs.notes =
          fresh.length > 1
            ? `${fresh.length} rörelser sparade`
            : hadCheckpoint || isBankAppBatch
              ? "Bekräftad och sparad"
              : "Första SMS — saldo och rörelse sparade";
        obs.updatedAt = ts;
      }
    });

    const after = await readStore();
    const lastTx = after.transactions.find((t) => t.id === lastTxId);
    if (!lastTx) throw new Error("Kunde inte spara importen");
    return {
      ...lastTx,
      balanceAfterMinor: tipBalance ?? lastTx.balanceAfterMinor,
    };
  }

  let fingerprint = input.fingerprint ?? null;
  let balanceAfterMinor = input.balanceAfterMinor ?? null;
  let source: TransactionSource = input.source ?? "receipt_camera";
  let maskedFromCandidate: string | null = input.maskedAccount ?? null;
  let direction: "debit" | "credit" = "debit";
  let amountMinor = input.amountMinor;
  let description = input.description;

  if (input.candidateId) {
    const cand = store.candidates.find(
      (c) =>
        c.id === input.candidateId &&
        c.userId === LOCAL_DEMO_USER_ID &&
        c.observationId === input.observationId,
    );
    if (!cand) throw new Error("Kandidaten hittades inte");
    if (cand.canonicalTransactionId) {
      const existing = store.transactions.find(
        (t) => t.id === cand.canonicalTransactionId && t.status !== "voided",
      );
      if (existing) return existing;
    }
    fingerprint = cand.fingerprint ?? fingerprint;
    balanceAfterMinor = cand.balanceAfterMinor ?? balanceAfterMinor;
    if (cand.amountMinor == null || cand.amountMinor <= 0) {
      throw new Error("Kandidaten saknar giltigt belopp");
    }
    amountMinor = cand.amountMinor;
    const isReceiptConfirm =
      input.source === "receipt_camera" || observation.kind === "receipt";
    // Receipt camera: prefer the amount/description the user confirmed in the UI.
    if (isReceiptConfirm && input.amountMinor != null && input.amountMinor > 0) {
      amountMinor = input.amountMinor;
    }
    if (cand.direction === "credit" || cand.direction === "debit") {
      direction = cand.direction;
    }
    if (isReceiptConfirm && input.description?.trim()) {
      description = input.description.trim();
    } else if (cand.description) {
      description = cand.description;
    }
    if (observation.kind === "screenshot") source = "screenshot";
  } else if (input.direction === "credit" || input.direction === "debit") {
    direction = input.direction;
  }

  if (amountMinor == null || amountMinor <= 0) {
    throw new Error("Ange ett belopp större än noll");
  }

  if (fingerprint) {
    const known = await listConfirmedFingerprints();
    if (known.includes(fingerprint)) {
      throw new Error("Den här bankrörelsen finns redan");
    }
  }

  maskedFromCandidate = maskedFromCandidate ?? observation.accountHint ?? null;

  const account =
    (input.accountId ? await getAccount(input.accountId) : null) ??
    (await ensureDefaultBankAccount({
      maskedIdentifier: maskedFromCandidate,
      currency: source === "screenshot" ? "THB" : undefined,
    }));

  const fresh = await readStore();
  const hadCheckpoint = latestCheckpointForAccount(fresh, account.id) != null;
  if (!hadCheckpoint && balanceAfterMinor == null && source === "screenshot") {
    throw new Error(
      "Första importen måste vara ett bank-SMS med saldo (available balance)",
    );
  }

  // Bank-SMS requires saldo; bank-app / receipt-with-fingerprint may omit it
  // once Hem already has a verified balance.
  if (
    source === "screenshot" &&
    (!fingerprint || (balanceAfterMinor == null && !hadCheckpoint))
  ) {
    throw new Error("Bank-SMS saknar komplett belopp/saldo — ta en tydligare bild.");
  }

  const baseMs = Date.now();
  const movedAt = new Date(baseMs - 2_000).toISOString();
  const checkpointAt = new Date(baseMs).toISOString();

  const tx =
    direction === "credit"
      ? await createManualIncome({
          accountId: account.id,
          amountMinor,
          description: description || "Insättning (bank-SMS)",
          source,
          sourceObservationId: input.observationId,
          fingerprint,
          balanceAfterMinor,
          occurredAt: movedAt,
        })
      : await createManualExpense({
          accountId: account.id,
          amountMinor,
          description,
          category: input.category,
          source,
          sourceObservationId: input.observationId,
          fingerprint,
          balanceAfterMinor,
          occurredAt: movedAt,
        });

  // Receipt OCR must not mint sms_* tip checkpoints — only bank-SMS with saldo.
  if (source === "screenshot" && balanceAfterMinor != null) {
    await createCheckpoint({
      accountId: account.id,
      balanceMinor: balanceAfterMinor,
      verifiedAt: checkpointAt,
      source: hadCheckpoint ? "sms_import" : "sms_bootstrap",
      note: hadCheckpoint
        ? "Saldo från Bangkok Bank SMS"
        : "Första saldo från Bangkok Bank SMS",
    });
  }

  await updateStore((s) => {
    const obs = s.observations.find((o) => o.id === input.observationId);
    if (obs) {
      obs.status = "processed";
      obs.notes =
        source === "receipt_camera"
          ? "Bekräftad och sparad som utgift"
          : hadCheckpoint
            ? "Bekräftad och sparad"
            : "Första SMS — saldo och rörelse sparade";
      obs.updatedAt = nowIso();
    }
    if (input.candidateId) {
      const cand = s.candidates.find((c) => c.id === input.candidateId);
      if (cand) {
        cand.status = "confirmed";
        cand.canonicalTransactionId = tx.id;
        cand.amountMinor = amountMinor;
        cand.direction = direction;
        cand.fingerprint = fingerprint;
        cand.balanceAfterMinor = balanceAfterMinor;
        cand.updatedAt = nowIso();
      }
    }
  });

  return tx;
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

export async function listPlanItems(): Promise<PlanItem[]> {
  const store = await readStore();
  return [...(store.planItems ?? [])]
    .filter((p) => p.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

export async function createPlanItem(input: {
  name: string;
  kind: PlanCategoryKind;
  amountMinor: number;
  currency: CurrencyCode;
  cadence?: string | null;
  nextDueAt?: string | null;
}): Promise<PlanItem> {
  if (input.amountMinor < 0) throw new Error("Belopp kan inte vara negativt");
  const updated = await updateStore((s) => {
    const ts = nowIso();
    const item: PlanItem = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      name: input.name.trim(),
      kind: input.kind,
      amountMinor: input.amountMinor,
      currency: input.currency,
      cadence: input.cadence ?? "monthly",
      nextDueAt: input.nextDueAt ?? null,
      isActive: true,
      settledAt: null,
      settledMinor: null,
      remainingDueAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    s.planItems = s.planItems ?? [];
    s.planItems.push(item);
  });
  return updated.planItems[updated.planItems.length - 1]!;
}

export async function updatePlanItem(input: {
  id: string;
  name?: string;
  kind?: PlanCategoryKind;
  amountMinor?: number;
  nextDueAt?: string | null;
  isActive?: boolean;
  settledAt?: string | null;
  settledMinor?: number | null;
  remainingDueAt?: string | null;
}): Promise<PlanItem> {
  let found: PlanItem | null = null;
  await updateStore((s) => {
    const item = (s.planItems ?? []).find((p) => p.id === input.id);
    if (!item) throw new Error("Planposten hittades inte");
    if (input.name != null) item.name = input.name.trim();
    if (input.kind != null) item.kind = input.kind;
    if (input.amountMinor != null) {
      if (input.amountMinor < 0) throw new Error("Belopp kan inte vara negativt");
      item.amountMinor = input.amountMinor;
    }
    if (input.nextDueAt !== undefined) item.nextDueAt = input.nextDueAt;
    if (input.isActive != null) item.isActive = input.isActive;
    if (input.settledAt !== undefined) item.settledAt = input.settledAt;
    if (input.settledMinor !== undefined) item.settledMinor = input.settledMinor;
    if (input.remainingDueAt !== undefined) item.remainingDueAt = input.remainingDueAt;
    item.updatedAt = nowIso();
    const shouldReconcile =
      (item.settledMinor ?? 0) > 0 ||
      s.transactions.some(
        (tx) =>
          tx.planItemId === item.id &&
          tx.ledgerOrigin === "plan_settle" &&
          tx.status === "confirmed",
      );
    if (shouldReconcile) {
      applySettleInMemory({
        item,
        transactions: s.transactions,
        allocations: s.planAllocations ?? [],
        accounts: s.accounts
          .filter((account) => account.isActive)
          .map((account) => {
            const checkpoint = latestCheckpointForAccount(s, account.id);
            return {
              id: account.id,
              isDefault: account.isDefault,
              currency: account.currency,
              fxRate: checkpoint?.fxRate ?? (account.currency === "THB" ? 1 : null),
            };
          }),
        settled: (item.settledMinor ?? 0) > 0,
        targetSettledMinor: item.settledMinor ?? 0,
        remainingDueAt: item.remainingDueAt ?? null,
        nowIso: nowIso(),
        newId,
        userId: LOCAL_DEMO_USER_ID,
      });
    }
    found = item;
  });
  return found!;
}

export async function settlePlanItemAtomic(input: {
  itemId: string;
  settled: boolean;
  targetSettledMinor?: number | null;
  remainingDueAt?: string | null;
  accountId?: string | null;
  clientMutationId?: string | null;
}): Promise<AtomicSettleResult> {
  let result: AtomicSettleResult | null = null;
  await updateStore((s) => {
    if (input.clientMutationId) {
      const cached = (s.mutationKeys ?? []).find(
        (row) => row.mutationId === input.clientMutationId,
      );
      if (cached) {
        result = cached.result as AtomicSettleResult;
        return;
      }
    }
    const item = (s.planItems ?? []).find((p) => p.id === input.itemId);
    if (!item) throw new Error("Planposten hittades inte");
    const accounts = s.accounts
      .filter((a) => a.isActive)
      .map((account) => {
        const checkpoint = latestCheckpointForAccount(s, account.id);
        return {
          id: account.id,
          isDefault: account.isDefault,
          currency: account.currency,
          fxRate: checkpoint?.fxRate ?? (account.currency === "THB" ? 1 : null),
        };
      });
    result = applySettleInMemory({
      item,
      transactions: s.transactions,
      allocations: s.planAllocations ?? [],
      accounts,
      settled: input.settled,
      targetSettledMinor: input.targetSettledMinor ?? null,
      remainingDueAt: input.remainingDueAt ?? null,
      accountId: input.accountId ?? null,
      nowIso: nowIso(),
      newId,
      userId: LOCAL_DEMO_USER_ID,
      clientMutationId: input.clientMutationId ?? null,
    });
    if (input.clientMutationId) {
      s.mutationKeys = s.mutationKeys ?? [];
      s.mutationKeys.push({
        userId: LOCAL_DEMO_USER_ID,
        mutationId: input.clientMutationId,
        kind: "settle",
        result,
        createdAt: nowIso(),
      });
    }
  });
  if (!result) throw new Error("Kunde inte uppdatera Klar");
  return result;
}

export async function linkTransactionToPlanItem(input: {
  transactionId: string;
  itemId: string;
  clientMutationId?: string | null;
}): Promise<AtomicLinkResult> {
  let result: AtomicLinkResult | null = null;
  await updateStore((s) => {
    const tx = s.transactions.find((row) => row.id === input.transactionId);
    const item = (s.planItems ?? []).find((p) => p.id === input.itemId);
    if (!tx) throw new Error("Rörelsen hittades inte");
    if (!item) throw new Error("Planposten hittades inte");
    s.planAllocations = s.planAllocations ?? [];
    const allocated = applyAllocateInMemory({
      item,
      transaction: tx,
      transactions: s.transactions,
      allocations: s.planAllocations,
      accounts: s.accounts.filter((a) => a.isActive),
      userId: LOCAL_DEMO_USER_ID,
      nowIso: nowIso(),
      newId,
      clientMutationId: input.clientMutationId ?? null,
    });
    if (!allocated.ok) {
      throw new Error(allocateErrorMessageSv(allocated.error));
    }
    result = {
      item: { ...allocated.item },
      transactionId: allocated.transactionId,
      allocatedCanonicalMinor: allocated.allocatedCanonicalMinor,
      idempotent: allocated.idempotent,
    };
  });
  if (!result) throw new Error("Kunde inte koppla transaktionen");
  return result;
}

export async function deletePlanItem(id: string): Promise<void> {
  await updateStore((s) => {
    const ts = nowIso();
    for (const tx of s.transactions) {
      if (
        tx.planItemId === id &&
        tx.ledgerOrigin === "plan_settle" &&
        tx.status === "confirmed"
      ) {
        tx.status = "voided";
        tx.updatedAt = ts;
      }
    }
    s.planAllocations = (s.planAllocations ?? []).filter(
      (row) => row.planItemId !== id,
    );
    const item = (s.planItems ?? []).find((p) => p.id === id);
    if (!item) throw new Error("Planposten hittades inte");
    item.isActive = false;
    item.updatedAt = nowIso();
  });
}

export { NEXT_INCOME_NAME };

export async function setNextIncomeDate(isoDate: string): Promise<PlanItem> {
  const store = await readStore();
  const currency =
    store.accounts.find((a) => a.isDefault)?.currency ?? store.profile.primaryCurrency;
  const existing = (store.planItems ?? []).find(
    (p) => p.isActive && p.name === NEXT_INCOME_NAME,
  );
  if (existing) {
    return updatePlanItem({
      id: existing.id,
      nextDueAt: isoDate,
      amountMinor: existing.amountMinor,
    });
  }
  return createPlanItem({
    name: NEXT_INCOME_NAME,
    kind: "expected",
    amountMinor: 0,
    currency,
    cadence: "income",
    nextDueAt: isoDate,
  });
}

export async function purgeExpiredObservations(input?: {
  now?: Date;
  retentionDays?: number;
}): Promise<{ purged: number }> {
  let purged = 0;
  await updateStore((s) => {
    const due = observationsDueForPurge(
      s.observations,
      input?.now ?? new Date(),
      input?.retentionDays ?? 30,
    );
    const ids = new Set(due.map((row) => row.id));
    for (const row of s.observations) {
      if (!ids.has(row.id)) continue;
      row.storagePath = null;
      row.notes = row.notes
        ? `${row.notes} · Bild raderad efter 30 dagar`
        : "Bild raderad efter 30 dagar";
      row.updatedAt = nowIso();
      purged += 1;
    }
  });
  return { purged };
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const store = await readStore();
  const profile = store.profile;
  const accounts = store.accounts.filter((a) => a.isActive);
  const primary = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
  const planItems = (store.planItems ?? []).filter((p) => p.isActive);
  const checkpoints = accounts.map((account) =>
    latestCheckpointForAccount(store, account.id),
  );
  const checkpoint = primary
    ? latestCheckpointForAccount(store, primary.id)
    : null;
  return assembleTodaySnapshot({
    profile,
    accounts,
    planItems,
    primary,
    checkpoint,
    checkpoints,
    transactions: store.transactions,
  });
}

export { hoursSince };
