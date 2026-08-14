/**
 * Decide how SMS/screenshot batch confirm should behave before writing.
 * Keeps the "no pending → ghost 1 öre" fallthrough from happening.
 */
export type SmsBatchConfirmDecision =
  | { action: "confirm"; pendingIds: string[] }
  | { action: "idempotent"; existingTransactionId: string }
  | { action: "empty" };

export function decideSmsBatchConfirm(input: {
  pendingCandidateIds: string[];
  /** Already-confirmed candidates on this observation (canonical tx ids). */
  confirmedCanonicalIds: Array<string | null | undefined>;
  /** Fallback: any non-voided tx already linked to the observation. */
  linkedTransactionIds: string[];
}): SmsBatchConfirmDecision {
  if (input.pendingCandidateIds.length > 0) {
    return { action: "confirm", pendingIds: input.pendingCandidateIds };
  }

  for (let i = input.confirmedCanonicalIds.length - 1; i >= 0; i--) {
    const id = input.confirmedCanonicalIds[i];
    if (id) return { action: "idempotent", existingTransactionId: id };
  }

  const linked = input.linkedTransactionIds.filter(Boolean);
  if (linked.length > 0) {
    return {
      action: "idempotent",
      existingTransactionId: linked[linked.length - 1]!,
    };
  }

  return { action: "empty" };
}

export function isUniqueViolationMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("duplicate key") ||
    m.includes("unique constraint") ||
    m.includes("numa_transactions_user_fingerprint_unique") ||
    m.includes("23505")
  );
}

export function swedishFingerprintConflictError(): string {
  return "Den här bankrörelsen finns redan";
}
