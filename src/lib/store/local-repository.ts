import {
  calculateAccountBalance,
  calculatePlanTotals,
  calculateSafeToSpend,
  NEXT_INCOME_NAME,
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
  type ExtractedTransactionCandidate,
  type ExtractionRun,
  type PlanCategoryKind,
  type PlanItem,
  type Profile,
  type SourceObservation,
  type TransactionSource,
} from "@/domain/finance";
import { money, type CurrencyCode } from "@/domain/money";
import { createExtractionProvider, resolveScreenshotImport } from "@/domain/imports";
import { rankForOnTrackDays } from "@/domain/gamification";
import { LOCAL_DEMO_USER_ID, type NumaStoreData } from "./types";
import { readStore, updateStore } from "./local-store";
import {
  assertUserOwnsStoragePath,
  buildUserStoragePath,
} from "./isolation";
import type { ConfirmReceiptInput, ReceiptUploadResult } from "./receipt-types";
import { emptyUserProgress, type UserProgress } from "./types-progress";
import type { TodaySnapshot } from "./types-snapshot";
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

export async function listAccounts(): Promise<Account[]> {
  const store = await readStore();
  return store.accounts.filter((a) => a.isActive);
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
  const primary = active.find((a) => a.isDefault) ?? active[0] ?? null;
  if (primary) {
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
    name: "Bangkok Bank",
    institution: "Bangkok Bank",
    accountType: "checking",
    currency: input?.currency ?? "THB",
    maskedIdentifier: input?.maskedIdentifier ?? null,
    makeDefault: true,
  });
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

export async function listKnownFingerprints(): Promise<string[]> {
  const store = await readStore();
  const fromTx = store.transactions
    .filter((t) => t.userId === LOCAL_DEMO_USER_ID && t.fingerprint)
    .map((t) => t.fingerprint!) ;
  const fromCandidates = store.candidates
    .filter(
      (c) =>
        c.userId === LOCAL_DEMO_USER_ID &&
        c.fingerprint &&
        (c.status === "confirmed" || c.status === "duplicate"),
    )
    .map((c) => c.fingerprint!);
  return [...new Set([...fromTx, ...fromCandidates])];
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
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }

  const store = await readStore();
  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error("Kontot hittades inte");
  if (
    input.sourceObservationId &&
    !store.observations.some(
      (o) =>
        o.id === input.sourceObservationId && o.userId === LOCAL_DEMO_USER_ID,
    )
  ) {
    throw new Error("Importen hittades inte");
  }

  if (input.fingerprint) {
    const known = await listKnownFingerprints();
    if (known.includes(input.fingerprint)) {
      throw new Error("Den här bankbetalningen finns redan");
    }
  }

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
      merchant: input.merchant ?? null,
      category: input.category ?? null,
      source: input.source ?? "manual",
      status: "confirmed",
      balanceAfterMinor: input.balanceAfterMinor ?? null,
      fingerprint: input.fingerprint ?? null,
      sourceObservationId: input.sourceObservationId ?? null,
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

export async function createCashWithdrawal(input: {
  fromAccountId: string;
  toAccountId?: string | null;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<{ out: CanonicalTransaction; inn: CanonicalTransaction | null }> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }

  const store = await readStore();
  const from = store.accounts.find((a) => a.id === input.fromAccountId);
  if (!from) throw new Error("Kontot hittades inte");
  const to = input.toAccountId
    ? store.accounts.find((a) => a.id === input.toAccountId)
    : null;
  if (input.toAccountId && !to) throw new Error("Kontantkontot hittades inte");
  if (to && from.currency !== to.currency) {
    throw new Error("Olika valutor stöds inte ännu");
  }

  let outId = "";
  let inId: string | null = null;
  await updateStore((s) => {
    const ts = nowIso();
    const occurredAt = input.occurredAt ?? ts;
    const description = input.description?.trim() || "Kontantuttag";
    const out: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: from.id,
      counterAccountId: to?.id ?? null,
      direction: "debit",
      transactionType: "cash_withdrawal",
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
    outId = out.id;
    s.transactions.push(out);
    if (to) {
      const inn: CanonicalTransaction = {
        ...out,
        id: newId(),
        accountId: to.id,
        counterAccountId: from.id,
        direction: "credit",
      };
      inId = inn.id;
      s.transactions.push(inn);
    }
  });

  const after = await readStore();
  return {
    out: after.transactions.find((t) => t.id === outId)!,
    inn: inId ? after.transactions.find((t) => t.id === inId)! : null,
  };
}

export async function listTransactions(accountId?: string): Promise<CanonicalTransaction[]> {
  const store = await readStore();
  return store.transactions
    .filter((t) => (accountId ? t.accountId === accountId : true))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function updateTransaction(input: {
  id: string;
  amountMinor?: number;
  description?: string;
  category?: string | null;
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
      tx.amountMinor = input.amountMinor;
    }
    if (input.description != null) {
      tx.description = input.description.trim() || tx.description;
    }
    if (input.category !== undefined) tx.category = input.category;
    tx.updatedAt = nowIso();
    found = tx;
  });
  return found!;
}

export async function voidTransaction(id: string): Promise<CanonicalTransaction> {
  let found: CanonicalTransaction | null = null;
  await updateStore((s) => {
    const tx = s.transactions.find(
      (t) => t.id === id && t.userId === LOCAL_DEMO_USER_ID,
    );
    if (!tx) throw new Error("Rörelsen hittades inte");
    tx.status = "voided";
    tx.updatedAt = nowIso();
    found = tx;
  });
  return found!;
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

export async function getObservation(
  observationId: string,
): Promise<SourceObservation | null> {
  const store = await readStore();
  return store.observations.find((o) => o.id === observationId) ?? null;
}

/** Dev-only in-memory progress (single tenant). */
const localProgress = new Map<string, UserProgress>();
const localProgressDays = new Set<string>();

export async function getUserProgress(): Promise<UserProgress | null> {
  return (
    localProgress.get(LOCAL_DEMO_USER_ID) ??
    emptyUserProgress(LOCAL_DEMO_USER_ID)
  );
}

export async function recordOnTrackDayIfNeeded(
  isOnTrack: boolean,
): Promise<UserProgress | null> {
  if (!isOnTrack) return getUserProgress();
  const store = await readStore();
  const dayKey = startOfZonedDay(new Date(), store.profile.timezone)
    .toISOString()
    .slice(0, 10);
  const key = `${LOCAL_DEMO_USER_ID}:${dayKey}`;
  if (localProgressDays.has(key)) return getUserProgress();
  localProgressDays.add(key);

  const current =
    localProgress.get(LOCAL_DEMO_USER_ID) ??
    emptyUserProgress(LOCAL_DEMO_USER_ID);
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
}): Promise<ReceiptUploadResult> {
  const storagePath = buildUserStoragePath(LOCAL_DEMO_USER_ID, input.fileName);
  assertUserOwnsStoragePath(LOCAL_DEMO_USER_ID, storagePath);

  try {
    const dir = path.join(process.cwd(), ".data", "media", LOCAL_DEMO_USER_ID);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(process.cwd(), ".data", "media", storagePath),
      input.bytes,
    );
  } catch {
    // Vercel/read-only: keep metadata-only path.
  }

  const observationId = newId();
  const runId = newId();
  const provider = createExtractionProvider();
  const imageBase64 = Buffer.from(input.bytes).toString("base64");
  const extraction = await provider.extract({
    observationId,
    storagePath,
    imageBase64,
    mimeType: input.mimeType,
  });

  const known = await listKnownFingerprints();
  const resolved = resolveScreenshotImport(extraction, known);
  const ts = nowIso();
  let candidate: ExtractedTransactionCandidate | null = null;

  await updateStore((s) => {
    const observation: SourceObservation = {
      id: observationId,
      userId: LOCAL_DEMO_USER_ID,
      kind: resolved.observationKind,
      storagePath,
      institutionHint:
        resolved.kind === "bank_sms" ? "Bangkok Bank" : null,
      accountHint:
        resolved.kind === "bank_sms"
          ? (resolved.selected?.maskedAccount ?? null)
          : null,
      status:
        resolved.alreadyKnown
          ? "processed"
          : resolved.suggestedAmountMinor
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
      },
      startedAt: ts,
      finishedAt: ts,
    };
    s.extractionRuns.push(run);

    if (resolved.suggestedAmountMinor != null && !resolved.alreadyKnown) {
      candidate = {
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
          resolved.kind === "bank_sms"
            ? (resolved.selected?.confidence ?? null)
            : null,
        fingerprint: resolved.fingerprint,
        status: "needs_review",
        canonicalTransactionId: null,
        rawPayload: {
          importKind: resolved.kind,
          labelSv: resolved.suggestedDescription,
        },
        createdAt: ts,
        updatedAt: ts,
      };
      s.candidates.push(candidate);
    }
  });

  const observation = (await getObservation(observationId))!;
  const profile = (await readStore()).profile;
  let ocrStatus: ReceiptUploadResult["ocrStatus"] = "ok";
  if (extraction.provider === "none") ocrStatus = "unavailable";
  else if (resolved.alreadyKnown) ocrStatus = "all_known";
  else if (resolved.suggestedAmountMinor == null) ocrStatus = "failed";

  const skippedOlderCount =
    resolved.kind === "bank_sms" && resolved.selection.status === "ready"
      ? resolved.selection.skippedOlderCount
      : 0;

  return {
    observation,
    candidate,
    suggestedAmountMinor: resolved.suggestedAmountMinor,
    suggestedDescription: resolved.suggestedDescription,
    currency: resolved.currency ?? profile.primaryCurrency,
    ocrStatus,
    message:
      ocrStatus === "unavailable"
        ? "Kunde inte autoläsa just nu. Skriv beloppet som drogs i SMS:et (t.ex. 65,00) — inte saldot."
        : resolved.messageSv,
    importKind:
      resolved.kind === "bank_sms"
        ? "bank_sms"
        : resolved.kind === "receipt_or_other"
          ? "receipt"
          : "unknown",
    balanceAfterMinor: resolved.balanceAfterMinor,
    fingerprint: resolved.fingerprint,
    alreadyKnown: resolved.alreadyKnown,
    skippedOlderCount,
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

  let fingerprint = input.fingerprint ?? null;
  let balanceAfterMinor = input.balanceAfterMinor ?? null;
  let source: TransactionSource = input.source ?? "receipt_camera";
  let maskedFromCandidate: string | null = input.maskedAccount ?? null;

  if (input.candidateId) {
    const cand = store.candidates.find(
      (c) =>
        c.id === input.candidateId &&
        c.userId === LOCAL_DEMO_USER_ID &&
        c.observationId === input.observationId,
    );
    if (!cand) throw new Error("Kandidaten hittades inte");
    fingerprint = fingerprint ?? cand.fingerprint;
    balanceAfterMinor = balanceAfterMinor ?? cand.balanceAfterMinor;
    if (observation.kind === "screenshot") source = "screenshot";
  }

  maskedFromCandidate =
    maskedFromCandidate ??
    observation.accountHint ??
    null;

  const account =
    (input.accountId
      ? (await getAccount(input.accountId))
      : null) ??
    (await ensureDefaultBankAccount({
      maskedIdentifier: maskedFromCandidate,
      currency: "THB",
    }));

  const fresh = await readStore();
  const hadCheckpoint = latestCheckpointForAccount(fresh, account.id) != null;
  if (!hadCheckpoint && balanceAfterMinor == null) {
    throw new Error(
      "Första importen måste vara ett bank-SMS med saldo (available balance)",
    );
  }

  // Expense slightly before checkpoint so bank balance-after is authoritative
  // and the debit still counts as today's spending without double-subtracting.
  const expenseAt = new Date(Date.now() - 2_000).toISOString();
  const checkpointAt = new Date().toISOString();

  const tx = await createManualExpense({
    accountId: account.id,
    amountMinor: input.amountMinor,
    description: input.description,
    category: input.category,
    source,
    sourceObservationId: input.observationId,
    fingerprint,
    balanceAfterMinor,
    occurredAt: expenseAt,
  });

  if (balanceAfterMinor != null) {
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
      obs.notes = hadCheckpoint
        ? "Bekräftad och sparad"
        : "Första SMS — saldo och utgift sparade";
      obs.updatedAt = nowIso();
    }
    if (input.candidateId) {
      const cand = s.candidates.find((c) => c.id === input.candidateId);
      if (cand) {
        cand.status = "confirmed";
        cand.canonicalTransactionId = tx.id;
        cand.amountMinor = input.amountMinor;
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
    item.updatedAt = nowIso();
    found = item;
  });
  return found!;
}

export async function deletePlanItem(id: string): Promise<void> {
  await updateStore((s) => {
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
    store.accounts.find((a) => a.isDefault)?.currency ??
    store.profile.primaryCurrency;
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

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const store = await readStore();
  const profile = store.profile;
  const accounts = store.accounts.filter((a) => a.isActive);
  const primary =
    accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
  const planItems = (store.planItems ?? []).filter((p) => p.isActive);

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
      flexibleMinor: 0,
      daysUntilIncome: 0,
      recentTransactions: [],
      planItems,
      currency: profile.primaryCurrency,
      progress: await getUserProgress(),
    };
  }

  const checkpoint = latestCheckpointForAccount(store, primary.id);

  // No bank truth yet — keep every money figure at zero until first SMS import.
  if (!checkpoint) {
    return {
      profile,
      accounts,
      primaryAccount: primary,
      checkpoint: null,
      calculatedBalanceMinor: 0,
      balanceKind: "unknown",
      verificationLabel: null,
      todaySpendingMinor: 0,
      monthSpendingMinor: 0,
      safeToSpendTodayMinor: 0,
      safeToSpendWeekMinor: 0,
      freeMinor: 0,
      reservedMinor: 0,
      bufferMinor: 0,
      flexibleMinor: 0,
      daysUntilIncome: 0,
      recentTransactions: [],
      planItems,
      currency: primary.currency,
      progress: await getUserProgress(),
    };
  }

  const accountTx = store.transactions
    .filter((t) => t.accountId === primary.id)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const after = filterTransactionsAfterCheckpoint(accountTx, checkpoint);
  let calculated = null;
  try {
    calculated = calculateAccountBalance({
      checkpoint,
      transactionsAfterCheckpoint: after,
    });
  } catch (error) {
    console.error("[numa] balance calc failed", error);
  }

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
  const totals = calculatePlanTotals(planItems, currency, now, 0);
  const available = calculated ?? money(0, currency);
  const safe = calculateSafeToSpend({
    available,
    reserved: money(totals.reservedMinor, currency),
    safetyBuffer: money(totals.bufferMinor, currency),
    daysUntilNextIncome: Math.max(1, totals.daysUntilNextIncome || 1),
    flexiblePlanRemaining:
      totals.flexibleMinor > 0
        ? money(totals.flexibleMinor, currency)
        : undefined,
  });

  let balanceKind: TodaySnapshot["balanceKind"] = "unknown";
  if (checkpoint && after.length === 0) balanceKind = "verified_checkpoint_only";
  else if (checkpoint && calculated) balanceKind = "calculated";
  else if (checkpoint) balanceKind = "verified_checkpoint_only";

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
    reservedMinor: totals.reservedMinor,
    bufferMinor: totals.bufferMinor,
    flexibleMinor: totals.flexibleMinor,
    daysUntilIncome: totals.daysUntilNextIncome,
    recentTransactions: [...accountTx]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 8),
    planItems,
    currency,
    progress: await getUserProgress(),
  };
}

export { hoursSince };
