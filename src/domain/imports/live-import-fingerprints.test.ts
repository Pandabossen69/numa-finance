import { describe, expect, it } from "vitest";
import { parseBankAppVisionRows, selectImportableBankAppEvents } from "./bank-app-parsers";
import { liveImportFingerprints } from "./live-import-fingerprints";

const ICA = [
  {
    merchant: "ICA",
    direction: "debit" as const,
    amountMajor: 89.5,
    currency: "SEK",
    occurredAt: "2026-09-25T10:00",
  },
];

function icaRows() {
  return parseBankAppVisionRows(ICA);
}

function icaFingerprint(): string {
  const first = selectImportableBankAppEvents(icaRows(), []);
  if (first.status !== "ready") throw new Error("expected a fresh ICA row");
  return first.selectedBatch[0]!.fingerprint.fingerprint;
}

describe("liveImportFingerprints", () => {
  it("ignores a voided match and still blocks a live one", () => {
    const fingerprint = icaFingerprint();
    const voided = liveImportFingerprints({
      transactions: [{ id: "tx-void", fingerprint, status: "voided" }],
      candidates: [
        {
          fingerprint,
          status: "confirmed",
          canonicalTransactionId: "tx-void",
        },
      ],
    });
    expect(voided).not.toContain(fingerprint);
    const afterVoid = selectImportableBankAppEvents(icaRows(), voided);
    expect(afterVoid.status).toBe("ready");
    if (afterVoid.status !== "ready") return;
    expect(afterVoid.messageSv).not.toMatch(/finns redan/);

    const live = liveImportFingerprints({
      transactions: [{ id: "tx-live", fingerprint, status: "confirmed" }],
      candidates: [
        {
          fingerprint,
          status: "confirmed",
          canonicalTransactionId: "tx-live",
        },
      ],
    });
    expect(live).toContain(fingerprint);
    const afterLive = selectImportableBankAppEvents(icaRows(), live);
    expect(afterLive.status).toBe("all_known");
    if (afterLive.status !== "all_known") return;
    expect(afterLive.messageSv).toBe("Den här rörelsen finns redan.");
  });

  it("does not treat deleted or soft-deleted statuses as saved", () => {
    const fingerprint = icaFingerprint();
    for (const status of ["deleted", "soft_deleted", "soft-deleted"]) {
      expect(
        liveImportFingerprints({
          transactions: [{ id: "tx", fingerprint, status }],
        }),
      ).toEqual([]);
    }
  });
});
