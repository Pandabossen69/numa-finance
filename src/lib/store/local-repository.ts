import {
  calculateAccountBalance,
  calculateDayPlanMinor,
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
import { createExtractionProvider } from "@/domain/imports";
import { rankForOnTrackDays } from "@/domain/gamification";
import { LOCAL_DEMO_USER_ID, type NumaStoreData } from "./types";
import { readStore, updateStore } from "./local-store";
import {
  assertUserOwnsStoragePath,
  buildUserStoragePath,
} from "./isolation";
import type { ConfirmReceiptInput, ReceiptUploadResult } from "./receipt-types";
import {
  emptyUserProgress,
  type RecordOnTrackDayResult,
  type UserProgress,
} from "./types-progress";
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
    const makeDefault = input.makeDefault ?? store.accounts.length === 0;
    if (makeDefault) {
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
      isDefault: makeDefault,
      createdAt: ts,
      updatedAt: ts,
    };
    store.accounts.push(account);
  });
  return created.accounts[created.accounts.length - 1]!;
}

export async function setDefaultAccount(accountId: string): Promise<Account> {
  const store = await readStore();
  const target = store.accounts.find((a) => a.id === accountId && a.isActive);
  if (!target) throw new Error("Kontot hittades inte");

  const updated = await updateStore((s) => {
    const ts = nowIso();
    for (const a of s.accounts) {
      const next = a.id === accountId;
      if (a.isDefault !== next) {
        a.isDefault = next;
        a.updatedAt = ts;
      }
    }
  });

  const account = updated.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error("Kontot hittades inte");
  return account;
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
  source?: TransactionSource;
  sourceObservationId?: string | null;
  merchant?: string | null;
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
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: input.sourceObservationId ?? null,
      transferGroupId: null,
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
      transferGroupId: null,
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
    const transferGroupId = newId();

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
  const to = store.accounts.find((a) => a.id === input.toAccountId);
  if (!to) throw new Error("Kontantkontot hittades inte");
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
    const out: CanonicalTransaction = {
      id: newId(),
      userId: LOCAL_DEMO_USER_ID,
      accountId: from.id,
      counterAccountId: to.id,
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

export async function listTransactions(accountId?: string): Promise<CanonicalTransaction[]> {
  const store = await readStore();
  return store.transactions
    .filter((t) => (accountId ? t.accountId === accountId : true))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function voidTransaction(id: string): Promise<CanonicalTransaction> {
  const store = await readStore();
  const target = store.transactions.find((t) => t.id === id);
  if (!target) throw new Error("Rörelsen hittades inte");

  const updated = await updateStore((s) => {
    const ts = nowIso();
    const ids = new Set<string>([id]);

    // Void linked transfer/cash legs so both sides disappear together.
    if (
      target.transactionType === "transfer" ||
      target.transactionType === "cash_withdrawal"
    ) {
      for (const tx of s.transactions) {
        if (tx.id === id) continue;
        if (tx.status === "voided") continue;
        if (
          target.transferGroupId &&
          tx.transferGroupId === target.transferGroupId
        ) {
          ids.add(tx.id);
          continue;
        }
        // Legacy rows without transferGroupId: heuristic sibling match.
        if (!target.transferGroupId && target.counterAccountId) {
          if (tx.transactionType !== target.transactionType) continue;
          if (tx.amountMinor !== target.amountMinor) continue;
          if (tx.occurredAt !== target.occurredAt) continue;
          if (
            tx.accountId === target.counterAccountId &&
            tx.counterAccountId === target.accountId
          ) {
            ids.add(tx.id);
          }
        }
      }
    }

    for (const tx of s.transactions) {
      if (!ids.has(tx.id)) continue;
      tx.status = "voided";
      tx.updatedAt = ts;
    }
  });

  const voided = updated.transactions.find((t) => t.id === id);
  if (!voided) throw new Error("Rörelsen hittades inte");
  return voided;
}

export async function updateManualTransaction(input: {
  id: string;
  description?: string;
  category?: string | null;
  amount?: string;
  amountMinor?: number;
}): Promise<CanonicalTransaction> {
  const store = await readStore();
  const target = store.transactions.find((t) => t.id === input.id);
  if (!target) throw new Error("Rörelsen hittades inte");
  if (target.status === "voided") {
    throw new Error("Borttagen rörelse kan inte ändras");
  }
  if (target.source !== "manual" && target.source !== "receipt_camera") {
    throw new Error("Den här rörelsen kan inte ändras här ännu");
  }
  if (
    target.transactionType === "transfer" ||
    target.transactionType === "cash_withdrawal"
  ) {
    throw new Error("Flytt/uttag ändras genom att ta bort och lägga till på nytt");
  }

  let nextAmount = target.amountMinor;
  if (input.amountMinor != null) {
    nextAmount = input.amountMinor;
  }
  if (nextAmount <= 0) throw new Error("Beloppet måste vara större än noll");

  const updated = await updateStore((s) => {
    const tx = s.transactions.find((t) => t.id === input.id);
    if (!tx) return;
    const ts = nowIso();
    if (input.description !== undefined) {
      tx.description = input.description.trim() || tx.description;
    }
    if (input.category !== undefined) {
      tx.category = input.category;
    }
    tx.amountMinor = nextAmount;
    tx.updatedAt = ts;
  });

  const row = updated.transactions.find((t) => t.id === input.id);
  if (!row) throw new Error("Rörelsen hittades inte");
  return row;
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

/** Read-only check — does not mark the day closed (unlike recordOnTrackDayIfNeeded). */
export async function hasClosedDayToday(): Promise<boolean> {
  const store = await readStore();
  const dayKey = startOfZonedDay(new Date(), store.profile.timezone)
    .toISOString()
    .slice(0, 10);
  return localProgressDays.has(`${LOCAL_DEMO_USER_ID}:${dayKey}`);
}

/**
 * Persist an on-track day (streak). Call only from day-close flows —
 * never from mid-day expense/receipt writes (those can lock a wrong status).
 */
export async function recordOnTrackDayIfNeeded(
  isOnTrack: boolean,
): Promise<RecordOnTrackDayResult> {
  const store = await readStore();
  const dayKey = startOfZonedDay(new Date(), store.profile.timezone)
    .toISOString()
    .slice(0, 10);
  const key = `${LOCAL_DEMO_USER_ID}:${dayKey}`;

  if (localProgressDays.has(key)) {
    return { progress: await getUserProgress(), alreadyRecordedToday: true };
  }
  localProgressDays.add(key);

  if (!isOnTrack) {
    return { progress: await getUserProgress(), alreadyRecordedToday: false };
  }

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
  return { progress: next, alreadyRecordedToday: false };
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

  const first = extraction.candidates[0];
  let candidate: ExtractedTransactionCandidate | null = null;
  const ts = nowIso();

  await updateStore((s) => {
    const observation: SourceObservation = {
      id: observationId,
      userId: LOCAL_DEMO_USER_ID,
      kind: "receipt",
      storagePath,
      institutionHint: null,
      accountHint: null,
      status: first?.amountMinor ? "needs_review" : "uploaded",
      capturedAt: ts,
      notes:
        extraction.provider === "none"
          ? "Bild sparad. Autoläsning är av — ange belopp själv."
          : first?.amountMinor
            ? "Vi hittade ett belopp — bekräfta innan det sparas."
            : "Kunde inte läsa beloppet automatiskt — ange själv.",
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
      rawMetadata: extraction.rawMetadata,
      startedAt: ts,
      finishedAt: ts,
    };
    s.extractionRuns.push(run);

    if (first) {
      candidate = {
        id: newId(),
        extractionRunId: runId,
        observationId,
        userId: LOCAL_DEMO_USER_ID,
        direction: first.direction,
        amountMinor: first.amountMinor,
        currency: first.currency,
        balanceAfterMinor: first.balanceAfterMinor,
        occurredAt: first.occurredAt,
        description: first.description,
        confidence: first.confidence,
        fingerprint: null,
        status: "needs_review",
        canonicalTransactionId: null,
        rawPayload: first.rawPayload,
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
  else if (!first?.amountMinor) ocrStatus = "failed";

  return {
    observation,
    candidate,
    suggestedAmountMinor: first?.amountMinor ?? null,
    suggestedDescription: first?.description ?? null,
    currency: first?.currency ?? profile.primaryCurrency,
    ocrStatus,
    message:
      ocrStatus === "unavailable"
        ? "Autoläsning är av. Ange beloppet från kvittot."
        : ocrStatus === "failed"
          ? "Vi kunde inte läsa beloppet säkert. Kontrollera och fyll i själv."
          : null,
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

  // Idempotent: double-submit must not create a second expense.
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
  }
  const already = store.transactions.find(
    (t) =>
      t.sourceObservationId === input.observationId &&
      t.source === "receipt_camera" &&
      t.status !== "voided",
  );
  if (already) return already;

  const tx = await createManualExpense({
    accountId: input.accountId,
    amountMinor: input.amountMinor,
    description: input.description,
    category: input.category,
    source: "receipt_camera",
    sourceObservationId: input.observationId,
  });

  await updateStore((s) => {
    const obs = s.observations.find((o) => o.id === input.observationId);
    if (obs) {
      obs.status = "processed";
      obs.notes = "Bekräftad och sparad som utgift";
      obs.updatedAt = nowIso();
    }
    if (input.candidateId) {
      const cand = s.candidates.find((c) => c.id === input.candidateId);
      if (cand) {
        cand.status = "confirmed";
        cand.canonicalTransactionId = tx.id;
        cand.amountMinor = input.amountMinor;
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
      dayPlanMinor: 0,
      safeToSpendTodayMinor: 0,
      safeToSpendWeekMinor: 0,
      freeMinor: 0,
      reservedMinor: 0,
      reservedPlannedMinor: 0,
      bufferMinor: 0,
      flexibleMinor: 0,
      flexiblePlannedMinor: 0,
      daysUntilIncome: 17,
      recentTransactions: [],
      planItems,
      planItemRemaining: [],
      currency: profile.primaryCurrency,
      progress: await getUserProgress(),
      dayClosedToday: await hasClosedDayToday(),
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
  const toSpendInput = (t: CanonicalTransaction) => ({
    amountMinor: t.amountMinor,
    description: t.description,
    category: t.category,
    currency: t.currency,
    transactionType: t.transactionType,
    status: t.status,
  });
  const periodSpend = monthTx.map(toSpendInput);
  const periodSpendBeforeToday = monthTx
    .filter((t) => !isSameZonedDay(t.occurredAt, now, timezone))
    .map(toSpendInput);
  const totals = calculatePlanTotals(planItems, currency, now, 17, periodSpend);
  const available = calculated ?? money(0, currency);
  const safe = calculateSafeToSpend({
    available,
    reserved: money(totals.reservedMinor, currency),
    safetyBuffer: money(totals.bufferMinor, currency),
    daysUntilNextIncome: totals.daysUntilNextIncome,
    flexiblePlanRemaining:
      totals.flexibleMinor > 0
        ? money(totals.flexibleMinor, currency)
        : undefined,
  });
  const dayPlanMinor = calculateDayPlanMinor({
    availableNowMinor: available.amountMinor,
    currency,
    todayTransactions: todayTx,
    periodSpendBeforeToday,
    planItems,
    now,
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
    dayPlanMinor,
    safeToSpendTodayMinor: safe.today.amountMinor,
    safeToSpendWeekMinor: safe.week.amountMinor,
    freeMinor: safe.free.amountMinor,
    reservedMinor: totals.reservedMinor,
    reservedPlannedMinor: totals.reservedPlannedMinor,
    bufferMinor: totals.bufferMinor,
    flexibleMinor: totals.flexibleMinor,
    flexiblePlannedMinor: totals.flexiblePlannedMinor,
    daysUntilIncome: totals.daysUntilNextIncome,
    recentTransactions: [...accountTx]
      .filter((t) => t.status !== "voided")
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 8),
    planItems,
    planItemRemaining: totals.itemRemaining,
    currency,
    progress: await getUserProgress(),
    dayClosedToday: await hasClosedDayToday(),
  };
}

export { hoursSince };
