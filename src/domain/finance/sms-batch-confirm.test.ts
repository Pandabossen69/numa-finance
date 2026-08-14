import { describe, expect, it } from "vitest";
import {
  decideSmsBatchConfirm,
  isUniqueViolationMessage,
  swedishFingerprintConflictError,
} from "./sms-batch-confirm";

describe("decideSmsBatchConfirm", () => {
  it("confirms when pending candidates exist", () => {
    expect(
      decideSmsBatchConfirm({
        pendingCandidateIds: ["c1", "c2"],
        confirmedCanonicalIds: [],
        linkedTransactionIds: [],
      }),
    ).toEqual({ action: "confirm", pendingIds: ["c1", "c2"] });
  });

  it("is idempotent when candidates already confirmed", () => {
    expect(
      decideSmsBatchConfirm({
        pendingCandidateIds: [],
        confirmedCanonicalIds: [null, "tx-1"],
        linkedTransactionIds: [],
      }),
    ).toEqual({ action: "idempotent", existingTransactionId: "tx-1" });
  });

  it("falls back to linked transactions", () => {
    expect(
      decideSmsBatchConfirm({
        pendingCandidateIds: [],
        confirmedCanonicalIds: [],
        linkedTransactionIds: ["old-1", "old-2"],
      }),
    ).toEqual({ action: "idempotent", existingTransactionId: "old-2" });
  });

  it("reports empty instead of inventing a ghost amount", () => {
    expect(
      decideSmsBatchConfirm({
        pendingCandidateIds: [],
        confirmedCanonicalIds: [null],
        linkedTransactionIds: [],
      }),
    ).toEqual({ action: "empty" });
  });
});

describe("fingerprint unique errors", () => {
  it("detects postgres unique violations", () => {
    expect(
      isUniqueViolationMessage(
        'duplicate key value violates unique constraint "numa_transactions_user_fingerprint_unique"',
      ),
    ).toBe(true);
    expect(isUniqueViolationMessage("timeout")).toBe(false);
  });

  it("returns swedish copy", () => {
    expect(swedishFingerprintConflictError()).toMatch(/finns redan/i);
  });
});
