import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parseBankMailPayment } from "@/domain/imports/bank-mail-parser";
import {
  BANK_MAIL_IGNORED_LOG,
  BANK_MAIL_OBSERVATION_KIND,
  BANK_MAIL_SOURCE_LABEL,
} from "@/features/imports/bank-mail-label";

export type BankMailAccountGate =
  | { ok: true; account: { id: string; name: string } }
  | { ok: false; reason: "missing" | "inactive" | "currency" };

export type BankMailPendingInsert = {
  userId: string;
  accountId: string;
  accountName: string;
  messageId: string | null;
  bankReference: string | null;
  fingerprint: string;
  maskedAccount: string | null;
  occurredAt: string;
  direction: "debit";
  amountMinor: number;
  currency: "THB";
  counterparty: string;
  isWalletTopUp: boolean;
  payeeCode: string | null;
  referenceNo1: string | null;
  referenceNo2: string | null;
  subject: string;
  from: string;
  mailDate: string;
};

export type BankMailStore = {
  findAccount(userId: string, accountId: string): Promise<BankMailAccountGate>;
  findByDedupeKey(
    userId: string,
    keys: {
      messageId: string | null;
      bankReference: string | null;
      fingerprint: string;
    },
  ): Promise<{ observationId: string } | null>;
  insertPending(
    row: BankMailPendingInsert,
  ): Promise<
    | { ok: true; observationId: string; candidateId: string }
    | { ok: false; duplicate: true; observationId: string | null }
  >;
};

export type BankMailIngestResult =
  | {
      result: "created";
      observationId: string;
      candidateId: string;
      amountMinor: number;
      occurredAt: string;
      counterparty: string;
      accountId: string;
      direction: "debit";
      isWalletTopUp: boolean;
      source: typeof BANK_MAIL_SOURCE_LABEL;
    }
  | { result: "duplicate"; observationId: string | null }
  | { result: "ignored" }
  | { result: "rejected"; reason: "missing" | "inactive" | "currency" };

const mailSchema = z.object({
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  subject: z.string().max(500).optional().default(""),
  from: z.string().max(500).optional().default(""),
  date: z.string().max(200).optional().default(""),
  body: z.string().min(1).max(200_000),
  messageId: z.string().max(500).optional().default(""),
});

export type BankMailFields = z.infer<typeof mailSchema>;

export function bankMailTokenMatches(
  authorization: string | null,
  expected: string | undefined,
): boolean {
  const secret = expected?.trim() ?? "";
  if (!secret || !authorization) return false;
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;
  const sent = authorization.slice(prefix.length).trim();
  if (!sent) return false;
  const a = createHash("sha256").update(sent).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export function bankMailUserAllowed(
  userId: string,
  allowlist: string | undefined,
): boolean {
  if (!allowlist) return false;
  const allowed = new Set(
    allowlist
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.has(userId.trim().toLowerCase());
}

export function normalizeBankMailMessageId(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  let trimmed = value.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">") && trimmed.length > 2) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

export function normalizeBankReference(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 200);
}

export function bankMailFingerprint(keys: {
  messageId: string | null;
  bankReference: string | null;
}): string | null {
  if (keys.bankReference) return `bbl-mail:ref:${keys.bankReference}`;
  if (keys.messageId) return `bbl-mail:msg:${keys.messageId}`;
  return null;
}

function readMessageId(raw: Record<string, unknown>): string {
  const value = raw.messageId ?? raw.messageID ?? raw["Message-ID"] ?? raw.message_id;
  return typeof value === "string" ? value : "";
}

/**
 * Map one mail onto a pending queue row. Returns null when the parser does
 * not recognize the mail, the amount/date is unusable, or there is no
 * Message-ID and no bank reference to dedupe on. Never writes a transaction.
 */
export function draftBankMailCandidate(input: {
  userId: string;
  accountId: string;
  accountName: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  messageId: string;
}): BankMailPendingInsert | null {
  const parsed = parseBankMailPayment(input.body);
  if (!parsed) return null;
  if (parsed.amountMinor == null || parsed.amountMinor <= 0) return null;
  if (!parsed.occurredAt) return null;
  const counterparty = parsed.merchant?.trim() || null;
  if (!counterparty) return null;

  const messageId = normalizeBankMailMessageId(input.messageId);
  const bankReference = normalizeBankReference(parsed.referenceNo);
  const fingerprint = bankMailFingerprint({ messageId, bankReference });
  if (!fingerprint) return null;

  return {
    userId: input.userId,
    accountId: input.accountId,
    accountName: input.accountName,
    messageId,
    bankReference,
    fingerprint,
    maskedAccount: parsed.maskedAccount,
    occurredAt: parsed.occurredAt,
    direction: "debit",
    amountMinor: parsed.amountMinor,
    currency: "THB",
    counterparty,
    isWalletTopUp: parsed.isWalletTopUp,
    payeeCode: parsed.payeeCode,
    referenceNo1: parsed.referenceNo1,
    referenceNo2: parsed.referenceNo2,
    subject: input.subject,
    from: input.from,
    mailDate: input.date,
  };
}

export async function ingestBankMail(
  input: BankMailFields & { messageId: string },
  store: BankMailStore,
  log: (line: string) => void = console.info,
): Promise<BankMailIngestResult> {
  const account = await store.findAccount(input.userId, input.accountId);
  if (!account.ok) return { result: "rejected", reason: account.reason };

  const draft = draftBankMailCandidate({
    ...input,
    accountName: account.account.name,
  });
  if (!draft) {
    log(BANK_MAIL_IGNORED_LOG);
    return { result: "ignored" };
  }

  const existing = await store.findByDedupeKey(input.userId, {
    messageId: draft.messageId,
    bankReference: draft.bankReference,
    fingerprint: draft.fingerprint,
  });
  if (existing) return { result: "duplicate", observationId: existing.observationId };

  const inserted = await store.insertPending(draft);
  if (!inserted.ok) {
    return { result: "duplicate", observationId: inserted.observationId };
  }

  return {
    result: "created",
    observationId: inserted.observationId,
    candidateId: inserted.candidateId,
    amountMinor: draft.amountMinor,
    occurredAt: draft.occurredAt,
    counterparty: draft.counterparty,
    accountId: draft.accountId,
    direction: draft.direction,
    isWalletTopUp: draft.isWalletTopUp,
    source: BANK_MAIL_SOURCE_LABEL,
  };
}

export type BankMailPostDeps = {
  token: string | undefined;
  allowlist: string | undefined;
  createStore: () => BankMailStore;
  log?: (line: string) => void;
};

/**
 * Shared by POST /api/import/bank-mail and a later Gmail webhook.
 * The service-role client is created by the caller, not here.
 */
export async function handleBankMailPost(
  request: Request,
  deps: BankMailPostDeps,
): Promise<Response> {
  if (!bankMailTokenMatches(request.headers.get("authorization"), deps.token)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const record = raw as Record<string, unknown>;
  const parsed = mailSchema.safeParse({
    userId: record.userId,
    accountId: record.accountId,
    subject: record.subject,
    from: record.from,
    date: record.date,
    body: record.body,
    messageId: readMessageId(record),
  });
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  if (!bankMailUserAllowed(parsed.data.userId, deps.allowlist)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let store: BankMailStore;
  try {
    store = deps.createStore();
  } catch (error) {
    console.error(
      "[numa] bank-mail ingest is not configured",
      error instanceof Error ? error.message : "error",
    );
    return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const outcome = await ingestBankMail(parsed.data, store, deps.log);
    if (outcome.result === "rejected") {
      const status = outcome.reason === "currency" ? 422 : 403;
      return Response.json(
        { ok: false, error: outcome.reason === "currency" ? "account_currency" : "account" },
        { status },
      );
    }
    if (outcome.result === "ignored") {
      return Response.json({ ok: true, result: "ignored" });
    }
    if (outcome.result === "duplicate") {
      return Response.json({
        ok: true,
        result: "duplicate",
        observationId: outcome.observationId,
      });
    }
    return Response.json(
      {
        ok: true,
        result: "created",
        observationId: outcome.observationId,
        candidateId: outcome.candidateId,
        amountMinor: outcome.amountMinor,
        occurredAt: outcome.occurredAt,
        counterparty: outcome.counterparty,
        accountId: outcome.accountId,
        direction: outcome.direction,
        isWalletTopUp: outcome.isWalletTopUp,
        source: outcome.source,
        kind: BANK_MAIL_OBSERVATION_KIND,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "[numa] bank-mail ingest failed",
      error instanceof Error ? error.message : "error",
    );
    return Response.json({ ok: false, error: "ingest_failed" }, { status: 500 });
  }
}
