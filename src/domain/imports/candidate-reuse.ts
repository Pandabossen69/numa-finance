import { isUniqueViolationMessage } from "@/domain/finance/sms-batch-confirm";
import { isVoidedTransactionStatus } from "./live-import-fingerprints";

/** Statuses that occupy numa_candidates_user_fingerprint_unique. */
const FINGERPRINT_BLOCKING_STATUSES = new Set([
  "pending",
  "needs_review",
  "confirmed",
  "duplicate",
]);

export const LIVE_MOVEMENT_ALREADY_SAVED_SV = "Den här rörelsen finns redan.";
export const UPLOAD_SAVE_FAILED_SV = "Kunde inte spara bilden. Försök igen.";

export type CandidatePlacement =
  | { action: "insert" }
  | { action: "reuse"; candidateId: string }
  | { action: "live_duplicate" };

/**
 * A candidate is dead when its canonical transaction was voided or is gone
 * (null id, or the id no longer resolves). A live ledger row must keep the
 * fingerprint so a re-upload is reported as a duplicate instead of inserted.
 */
export function isDeadCanonicalLink(input: {
  canonicalTransactionId: string | null;
  /** Null when the id is missing or the transaction row was not found. */
  canonicalStatus: string | null;
}): boolean {
  if (!input.canonicalTransactionId) return true;
  if (input.canonicalStatus == null || input.canonicalStatus.trim() === "") {
    return true;
  }
  return isVoidedTransactionStatus(input.canonicalStatus);
}

export function decideCandidatePlacement(input: {
  matches: readonly {
    id: string;
    status: string;
    canonicalTransactionId: string | null;
    canonicalStatus: string | null;
  }[];
}): CandidatePlacement {
  const blocking = input.matches.filter((row) =>
    FINGERPRINT_BLOCKING_STATUSES.has(row.status.trim().toLowerCase()),
  );
  if (blocking.length === 0) return { action: "insert" };

  const live = blocking.find(
    (row) =>
      !isDeadCanonicalLink({
        canonicalTransactionId: row.canonicalTransactionId,
        canonicalStatus: row.canonicalStatus,
      }),
  );
  if (live) return { action: "live_duplicate" };

  const reuse =
    blocking.find((row) => {
      const status = row.status.trim().toLowerCase();
      return status === "confirmed" || status === "duplicate";
    }) ?? blocking[0]!;
  return { action: "reuse", candidateId: reuse.id };
}

type FingerprintCandidate = {
  id: string;
  userId: string;
  fingerprint: string | null;
  status: string;
  canonicalTransactionId: string | null;
};

/**
 * In-memory stand-in for the partial unique index. Dead blockers are updated
 * in place (needs_review, canonical link cleared). A live blocker is not inserted.
 */
export function stageCandidateFingerprintWrite<T extends FingerprintCandidate>(input: {
  rows: readonly T[];
  transactions: readonly { id: string; status: string }[];
  incoming: T;
}): { rows: T[]; written: T } | { error: "live_duplicate" } {
  const fingerprint = input.incoming.fingerprint?.trim() || null;
  if (!fingerprint) {
    const written = {
      ...input.incoming,
      status: "needs_review",
      canonicalTransactionId: null,
    };
    return { rows: [...input.rows, written], written };
  }

  const txStatus = new Map(input.transactions.map((tx) => [tx.id, tx.status]));
  const decision = decideCandidatePlacement({
    matches: input.rows
      .filter(
        (row) =>
          row.userId === input.incoming.userId &&
          (row.fingerprint?.trim() || null) === fingerprint,
      )
      .map((row) => ({
        id: row.id,
        status: row.status,
        canonicalTransactionId: row.canonicalTransactionId,
        canonicalStatus: row.canonicalTransactionId
          ? (txStatus.get(row.canonicalTransactionId) ?? null)
          : null,
      })),
  });

  if (decision.action === "live_duplicate") return { error: "live_duplicate" };

  if (decision.action === "reuse") {
    let written: T | null = null;
    const rows = input.rows.map((row) => {
      if (row.id !== decision.candidateId) return row;
      written = {
        ...input.incoming,
        id: row.id,
        status: "needs_review",
        canonicalTransactionId: null,
      };
      return written;
    });
    if (!written) return { error: "live_duplicate" };
    return { rows, written };
  }

  const clashes = input.rows.some(
    (row) =>
      row.userId === input.incoming.userId &&
      (row.fingerprint?.trim() || null) === fingerprint &&
      FINGERPRINT_BLOCKING_STATUSES.has(row.status.trim().toLowerCase()),
  );
  if (clashes) {
    throw new Error(
      'duplicate key value violates unique constraint "numa_candidates_user_fingerprint_unique"',
    );
  }

  const written = {
    ...input.incoming,
    fingerprint,
    status: "needs_review",
    canonicalTransactionId: null,
  };
  return { rows: [...input.rows, written], written };
}

export function candidateIdsToRejectAfterVoid(
  candidates: readonly {
    id: string;
    status: string;
    canonicalTransactionId: string | null;
  }[],
  voidedTransactionIds: readonly string[],
): string[] {
  const ids = new Set(voidedTransactionIds);
  return candidates
    .filter(
      (candidate) =>
        candidate.canonicalTransactionId != null &&
        ids.has(candidate.canonicalTransactionId) &&
        candidate.status !== "rejected",
    )
    .map((candidate) => candidate.id);
}

/** User-facing Fota upload failure. Never returns a raw database message. */
export function uploadErrorMessageSv(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("finns redan") || isUniqueViolationMessage(message)) {
    return LIVE_MOVEMENT_ALREADY_SAVED_SV;
  }
  return UPLOAD_SAVE_FAILED_SV;
}
