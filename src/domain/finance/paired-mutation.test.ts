import { describe, expect, it } from "vitest";
import {
  replayPairedMoneyMove,
  requireCompletePairedReplay,
  type PairedMutationRow,
} from "./paired-mutation";

function row(
  partial: Partial<PairedMutationRow> & Pick<PairedMutationRow, "id" | "direction">,
): PairedMutationRow {
  return {
    status: "confirmed",
    clientMutationId: null,
    transferGroupId: "group-1",
    ...partial,
  };
}

describe("replayPairedMoneyMove", () => {
  it("returns the complete debit+credit pair for a mutation id on the debit", () => {
    const out = row({
      id: "d1",
      direction: "debit",
      clientMutationId: "mut-1",
    });
    const inn = row({ id: "c1", direction: "credit" });
    expect(replayPairedMoneyMove("mut-1", [out, inn])).toEqual({ out, inn });
  });

  it("is missing when the mutation id has not been written", () => {
    expect(replayPairedMoneyMove("mut-1", [])).toBe("missing");
  });

  it("is incomplete when the debit exists without its credit", () => {
    expect(
      replayPairedMoneyMove("mut-1", [
        row({ id: "d1", direction: "debit", clientMutationId: "mut-1" }),
      ]),
    ).toBe("incomplete");
  });

  it("ignores voided legs", () => {
    expect(
      replayPairedMoneyMove("mut-1", [
        row({
          id: "d1",
          direction: "debit",
          clientMutationId: "mut-1",
          status: "voided",
        }),
        row({ id: "c1", direction: "credit" }),
      ]),
    ).toBe("missing");
  });
});

describe("requireCompletePairedReplay", () => {
  it("returns null without a mutation id or when nothing is stored", () => {
    expect(requireCompletePairedReplay(null, [], "broken")).toBeNull();
    expect(requireCompletePairedReplay("mut-1", [], "broken")).toBeNull();
  });

  it("throws rather than returning a half transfer", () => {
    expect(() =>
      requireCompletePairedReplay(
        "mut-1",
        [row({ id: "d1", direction: "debit", clientMutationId: "mut-1" })],
        "broken",
      ),
    ).toThrow("broken");
  });
});
