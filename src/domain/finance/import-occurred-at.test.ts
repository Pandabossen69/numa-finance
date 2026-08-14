import { describe, expect, it } from "vitest";
import { resolveSmsBatchOccurredAt } from "./import-occurred-at";
import {
  hasCycleFundingEvidence,
  isFundingEvidenceTransaction,
} from "./living-budget";
import { zonedDayKey, zonedWallTimeToUtcIso } from "./datetime";

describe("resolveSmsBatchOccurredAt", () => {
  const baseMs = Date.parse("2026-08-14T15:00:00.000Z");

  it("prefers candidate OCR timestamp", () => {
    expect(
      resolveSmsBatchOccurredAt({
        candidateOccurredAt: "2026-08-14T08:00:00.000Z",
        index: 0,
        batchLength: 2,
        baseMs,
        tipInBatch: true,
      }),
    ).toBe("2026-08-14T08:00:00.000Z");
  });

  it("uses confirm-time synthetics for live tip imports", () => {
    const iso = resolveSmsBatchOccurredAt({
      candidateOccurredAt: null,
      index: 0,
      batchLength: 1,
      baseMs,
      tipInBatch: true,
    });
    expect(iso).toBe("2026-08-14T14:59:57.000Z");
  });

  it("parks older tip-less reimports on the previous day", () => {
    const iso = resolveSmsBatchOccurredAt({
      candidateOccurredAt: null,
      index: 0,
      batchLength: 1,
      baseMs,
      tipInBatch: false,
    });
    expect(iso).toBe("2026-08-13T14:59:57.000Z");
  });
});

describe("funding evidence ignores bank-SMS credits", () => {
  it("rejects screenshot PromptPay credits as cycle funding", () => {
    expect(
      isFundingEvidenceTransaction({
        status: "confirmed",
        direction: "credit",
        transactionType: "income",
        occurredAt: "2026-08-14T10:00:00.000Z",
        source: "screenshot",
        fingerprint: "bb|credit|1",
        balanceAfterMinor: 1_000_000,
        sourceObservationId: "obs",
      }),
    ).toBe(false);
  });

  it("accepts manual income credits", () => {
    expect(
      isFundingEvidenceTransaction({
        status: "confirmed",
        direction: "credit",
        transactionType: "income",
        occurredAt: "2026-08-14T10:00:00.000Z",
        source: "manual",
      }),
    ).toBe(true);
  });

  it("hasCycleFundingEvidence skips bank-SMS credits in the window", () => {
    expect(
      hasCycleFundingEvidence({
        cycleStartAt: "2026-08-01T00:00:00.000Z",
        cycleEndAt: "2026-09-01T00:00:00.000Z",
        transactions: [
          {
            status: "confirmed",
            direction: "credit",
            transactionType: "income",
            occurredAt: "2026-08-10T00:00:00.000Z",
            source: "screenshot",
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("zonedWallTimeToUtcIso", () => {
  it("keeps Bangkok evening on the same calendar day", () => {
    const iso = zonedWallTimeToUtcIso("2026-07-23T23:30:00", "Asia/Bangkok");
    expect(iso).toBe("2026-07-23T23:30:00+07:00");
    expect(zonedDayKey(iso, "Asia/Bangkok")).toBe("2026-07-23");
  });
});
