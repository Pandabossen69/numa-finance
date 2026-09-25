import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LIVE_MOVEMENT_ALREADY_SAVED_SV,
  UPLOAD_SAVE_FAILED_SV,
  candidateIdsToRejectAfterVoid,
  decideCandidatePlacement,
  stageCandidateFingerprintWrite,
  uploadErrorMessageSv,
} from "./candidate-reuse";

const USER = "user-1";
const FP = "fp-ica-sek";

type Row = {
  id: string;
  userId: string;
  fingerprint: string | null;
  status: string;
  canonicalTransactionId: string | null;
  description: string | null;
  amountMinor: number | null;
};

function stale(overrides: Partial<Row> = {}): Row {
  return {
    id: "cand-stale",
    userId: USER,
    fingerprint: FP,
    status: "confirmed",
    canonicalTransactionId: "tx-old",
    description: "ICA gammal",
    amountMinor: 8950,
    ...overrides,
  };
}

function incoming(): Row {
  return {
    id: "cand-new",
    userId: USER,
    fingerprint: FP,
    status: "needs_review",
    canonicalTransactionId: null,
    description: "ICA ny",
    amountMinor: 9000,
  };
}

describe("stale confirmed candidates are reused instead of inserted", () => {
  it("reuses a confirmed candidate whose canonical transaction is voided", () => {
    const existing = stale();
    const staged = stageCandidateFingerprintWrite({
      rows: [existing],
      transactions: [{ id: "tx-old", status: "voided" }],
      incoming: incoming(),
    });
    expect("error" in staged).toBe(false);
    if ("error" in staged) return;
    expect(staged.rows).toHaveLength(1);
    expect(staged.written.id).toBe("cand-stale");
    expect(staged.written.status).toBe("needs_review");
    expect(staged.written.canonicalTransactionId).toBeNull();
    expect(staged.written.description).toBe("ICA ny");
    expect(staged.written.amountMinor).toBe(9000);
  });

  it("reuses a confirmed candidate whose canonical id is null", () => {
    const staged = stageCandidateFingerprintWrite({
      rows: [stale({ canonicalTransactionId: null })],
      transactions: [],
      incoming: incoming(),
    });
    expect("error" in staged).toBe(false);
    if ("error" in staged) return;
    expect(staged.rows).toHaveLength(1);
    expect(staged.written.id).toBe("cand-stale");
    expect(staged.written.status).toBe("needs_review");
    expect(staged.written.canonicalTransactionId).toBeNull();
    expect(staged.written.description).toBe("ICA ny");
  });

  it("reuses a confirmed candidate whose canonical transaction row is missing", () => {
    const decision = decideCandidatePlacement({
      matches: [
        {
          id: "cand-stale",
          status: "confirmed",
          canonicalTransactionId: "tx-gone",
          canonicalStatus: null,
        },
      ],
    });
    expect(decision).toEqual({ action: "reuse", candidateId: "cand-stale" });
  });

  it("does not insert when the colliding candidate still points at a live transaction", () => {
    const staged = stageCandidateFingerprintWrite({
      rows: [stale()],
      transactions: [{ id: "tx-old", status: "confirmed" }],
      incoming: incoming(),
    });
    expect(staged).toEqual({ error: "live_duplicate" });
    expect(LIVE_MOVEMENT_ALREADY_SAVED_SV).toBe("Den här rörelsen finns redan.");
  });

  it("would violate the unique index if a dead confirmed row were inserted again", () => {
    const naive = () =>
      stageCandidateFingerprintWrite({
        rows: [stale({ status: "confirmed" })],
        transactions: [{ id: "tx-old", status: "voided" }],
        incoming: incoming(),
      });
    const reused = naive();
    expect("error" in reused).toBe(false);
    expect(() => {
      const blocking = [stale(), { ...incoming(), id: "cand-second" }];
      const occupied = new Set<string>();
      for (const row of blocking) {
        if (
          row.fingerprint &&
          ["pending", "needs_review", "confirmed", "duplicate"].includes(row.status)
        ) {
          const key = `${row.userId}:${row.fingerprint}`;
          if (occupied.has(key)) {
            throw new Error(
              'duplicate key value violates unique constraint "numa_candidates_user_fingerprint_unique"',
            );
          }
          occupied.add(key);
        }
      }
    }).toThrow(/numa_candidates_user_fingerprint_unique/);
  });
});

describe("voiding a transaction rejects its candidates", () => {
  it("marks linked candidates rejected and leaves unrelated rows", () => {
    const ids = candidateIdsToRejectAfterVoid(
      [
        {
          id: "cand-linked",
          status: "confirmed",
          canonicalTransactionId: "tx-1",
        },
        {
          id: "cand-other",
          status: "confirmed",
          canonicalTransactionId: "tx-2",
        },
        {
          id: "cand-already",
          status: "rejected",
          canonicalTransactionId: "tx-1",
        },
      ],
      ["tx-1"],
    );
    expect(ids).toEqual(["cand-linked"]);
  });
});

describe("upload errors never leak raw database text", () => {
  it("maps a live fingerprint collision to the Swedish duplicate sentence", () => {
    expect(
      uploadErrorMessageSv(
        new Error(
          'duplicate key value violates unique constraint "numa_candidates_user_fingerprint_unique"',
        ),
      ),
    ).toBe(LIVE_MOVEMENT_ALREADY_SAVED_SV);
    expect(LIVE_MOVEMENT_ALREADY_SAVED_SV).not.toMatch(/duplicate key|unique constraint/i);
  });

  it("maps any other failure to a friendly Swedish save message", () => {
    const message = uploadErrorMessageSv(new Error("relation numa.nope does not exist"));
    expect(message).toBe(UPLOAD_SAVE_FAILED_SV);
    expect(message).toBe("Kunde inte spara bilden. Försök igen.");
    expect(message).not.toMatch(/relation|does not exist|duplicate key/i);
  });
});

describe("repositories void linked candidates and reuse dead fingerprints", () => {
  it("rejects candidates from voidTransaction and places uploads through the reuse helper", () => {
    const supabase = readFileSync(
      new URL("../../lib/store/supabase-repository.ts", import.meta.url),
      "utf8",
    );
    const local = readFileSync(
      new URL("../../lib/store/local-repository.ts", import.meta.url),
      "utf8",
    );
    const supabaseVoid = supabase.slice(
      supabase.indexOf("export async function voidTransaction"),
      supabase.indexOf("export async function listKnownFingerprints"),
    );
    const localVoid = local.slice(
      local.indexOf("export async function voidTransaction"),
      local.indexOf("export async function createScreenshotObservation"),
    );
    expect(supabaseVoid).toContain('status: "rejected"');
    expect(supabaseVoid).toContain("canonical_transaction_id");
    expect(localVoid).toContain("candidateIdsToRejectAfterVoid");
    expect(localVoid).toContain('status = "rejected"');
    expect(supabase).toContain("decideCandidatePlacement");
    expect(local).toContain("stageCandidateFingerprintWrite");
  });
});
