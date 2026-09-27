/**
 * Fingerprints that mean “finns redan sparad” in Fota.
 * NUMA soft-deletes a transaction by setting status to `voided`
 * (there is no voided_at column). Only a live ledger row counts.
 * A confirmed candidate whose transaction was voided must not block a re-scan.
 */

const LIVE_TX_STATUSES = new Set(["confirmed", "pending_sync", "needs_review"]);

/** Candidate rows that must never occupy the “finns redan” set. */
const IGNORED_CANDIDATE_STATUSES = new Set([
  "rejected",
  "voided",
  "deleted",
  "soft_deleted",
  "soft-deleted",
]);

export function isVoidedTransactionStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return (
    normalized === "voided" ||
    normalized === "deleted" ||
    normalized === "soft_deleted" ||
    normalized === "soft-deleted"
  );
}

export function liveImportFingerprints(input: {
  transactions: readonly {
    id?: string | null;
    fingerprint?: string | null;
    status?: string | null;
  }[];
  candidates?: readonly {
    fingerprint?: string | null;
    status?: string | null;
    canonicalTransactionId?: string | null;
  }[];
  /** Abandoned needs_review candidates stay out unless a caller opts in. */
  includePendingCandidates?: boolean;
}): string[] {
  const liveIds = new Set<string>();
  const fingerprints = new Set<string>();

  for (const tx of input.transactions) {
    if (isVoidedTransactionStatus(tx.status)) continue;
    if (!LIVE_TX_STATUSES.has((tx.status ?? "").trim().toLowerCase())) continue;
    if (tx.id) liveIds.add(tx.id);
    const fingerprint = tx.fingerprint?.trim();
    if (fingerprint) fingerprints.add(fingerprint);
  }

  const pending = input.includePendingCandidates === true;
  for (const candidate of input.candidates ?? []) {
    const status = (candidate.status ?? "").trim().toLowerCase();
    if (IGNORED_CANDIDATE_STATUSES.has(status)) continue;
    const counts =
      status === "confirmed" ||
      status === "duplicate" ||
      (pending && status === "needs_review");
    if (!counts) continue;
    // A confirmed/duplicate candidate only counts while its ledger row is live.
    // Voided, missing, or unlinked canonical ids are ignored.
    const linked = candidate.canonicalTransactionId;
    if (!linked || !liveIds.has(linked)) continue;
    const fingerprint = candidate.fingerprint?.trim();
    if (fingerprint) fingerprints.add(fingerprint);
  }

  return [...fingerprints];
}
