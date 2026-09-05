import { describe, expect, it } from "vitest";
import { projectCashCoverage } from "./cash-coverage";
import {
  planItemAlreadyFundedInLedger,
  planSettleKind,
  planSettleTargetMinor,
  previewPlanSettleEffect,
  signedPlanSettleSaldoDelta,
} from "./plan-settle-ledger";
import type { CanonicalTransaction, PlanItem } from "./types";

const tz = "Asia/Bangkok";

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor" | "name">,
): PlanItem {
  return {
    id: partial.id ?? "csn",
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "income",
    nextDueAt: partial.nextDueAt ?? "2026-08-25T12:00:00.000Z",
    isActive: true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: partial.remainingDueAt ?? null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function tx(
  partial: Partial<CanonicalTransaction> &
    Pick<CanonicalTransaction, "id" | "amountMinor">,
): CanonicalTransaction {
  return {
    id: partial.id,
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    currency: "THB",
    description: partial.description ?? "CSN",
    merchant: null,
    category: null,
    status: "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    syncStatus: "saved",
    createdAt: "2026-08-25T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
    transferGroupId: null,
    planItemId: partial.planItemId ?? null,
    ledgerOrigin: partial.ledgerOrigin,
    linkedPlanItemId: partial.linkedPlanItemId ?? null,
    amountMinor: partial.amountMinor,
    occurredAt: partial.occurredAt ?? "2026-08-25T09:00:00.000Z",
    direction: partial.direction ?? "credit",
    transactionType: partial.transactionType ?? "income",
    source: partial.source ?? "sms",
  };
}

const csn = item({
  name: "CSN",
  kind: "expected",
  amountMinor: 57_000_00,
  cadence: "income",
});

describe("plan settle ledger math", () => {
  it("books the full amount on Mottagen and the reverse on Ångra", () => {
    expect(planSettleKind(csn)).toBe("income");
    expect(planSettleTargetMinor(csn, { settled: true })).toBe(57_000_00);
    expect(planSettleTargetMinor(csn, { settled: false })).toBe(0);
    expect(signedPlanSettleSaldoDelta("income", 57_000_00)).toBe(57_000_00);
    expect(signedPlanSettleSaldoDelta("expense", 57_000_00)).toBe(-57_000_00);

    const mottagen = previewPlanSettleEffect({
      item: csn,
      targetBookedMinor: 57_000_00,
      transactions: [],
      timeZone: tz,
    });
    expect(mottagen?.saldoDeltaMinor).toBe(57_000_00);
    expect(mottagen?.incomingDeltaMinor).toBe(-57_000_00);
    expect(mottagen?.skippedBecauseFunded).toBe(false);

    const undo = previewPlanSettleEffect({
      item: { ...csn, settledAt: "2026-08-25T12:00:00.000Z", settledMinor: 57_000_00 },
      targetBookedMinor: 0,
      transactions: [],
      timeZone: tz,
    });
    expect(undo?.saldoDeltaMinor).toBe(-57_000_00);
    expect(undo?.incomingDeltaMinor).toBe(57_000_00);
  });

  it("does not move saldo when the user confirmed a transaction↔plan link", () => {
    const bank = tx({
      id: "bank-csn",
      amountMinor: 57_000_00,
      linkedPlanItemId: csn.id,
      ledgerOrigin: "external",
    });
    expect(
      planItemAlreadyFundedInLedger({
        item: csn,
        transactions: [bank],
        kind: "income",
        monthKey: "2026-08",
        timeZone: tz,
      }),
    ).toBe(true);

    const preview = previewPlanSettleEffect({
      item: csn,
      targetBookedMinor: 57_000_00,
      transactions: [bank],
      timeZone: tz,
    });
    expect(preview?.skippedBecauseFunded).toBe(true);
    expect(preview?.saldoDeltaMinor).toBe(0);
    expect(preview?.incomingDeltaMinor).toBe(0);
  });

  it("does not treat a similar unlinked bank row as already funded", () => {
    const bank = tx({ id: "bank-csn", amountMinor: 57_000_00 });
    expect(
      planItemAlreadyFundedInLedger({
        item: csn,
        transactions: [bank],
        kind: "income",
        monthKey: "2026-08",
        timeZone: tz,
      }),
    ).toBe(false);
  });

  it("ignores a synthetic settle booking when deciding already-funded", () => {
    const synthetic = tx({
      id: "settle-csn",
      amountMinor: 57_000_00,
      source: "manual",
      planItemId: csn.id,
    });
    expect(
      planItemAlreadyFundedInLedger({
        item: csn,
        transactions: [synthetic],
        kind: "income",
        monthKey: "2026-08",
        timeZone: tz,
      }),
    ).toBe(false);
  });

  it("keeps Över still when saldo and Kommer in move together", () => {
    const open = projectCashCoverage({
      planItems: [csn],
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 10_000_00,
    });
    expect(open.incomingMinor).toBe(57_000_00);
    expect(open.overMinor).toBe(67_000_00);

    const after = projectCashCoverage({
      planItems: [
        {
          ...csn,
          settledAt: "2026-08-25T12:00:00.000Z",
          settledMinor: 57_000_00,
        },
      ],
      transactions: [
        tx({
          id: "settle-csn",
          amountMinor: 57_000_00,
          source: "manual",
          planItemId: csn.id,
        }),
      ],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 67_000_00,
    });
    expect(after.incomingMinor).toBe(0);
    expect(after.overMinor).toBe(open.overMinor);
  });

  it("does not let one settle booking pay a sibling bill", () => {
    const hyra = item({
      id: "hyra",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 10_000_00,
      cadence: "monthly",
      nextDueAt: "2026-08-25T12:00:00.000Z",
      settledAt: "2026-08-25T14:00:00.000Z",
      settledMinor: 10_000_00,
    });
    const el = item({
      id: "el",
      name: "El",
      kind: "mandatory",
      amountMinor: 10_000_00,
      cadence: "monthly",
      nextDueAt: "2026-08-27T12:00:00.000Z",
    });
    const view = projectCashCoverage({
      planItems: [hyra, el],
      transactions: [
        tx({
          id: "settle-hyra",
          amountMinor: 10_000_00,
          direction: "debit",
          transactionType: "expense",
          description: "Hyra",
          source: "manual",
          planItemId: hyra.id,
          occurredAt: "2026-08-31T10:00:00.000Z",
        }),
      ],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 40_000_00,
    });
    expect(view.unpaidMinor).toBe(10_000_00);
    expect(view.overMinor).toBe(30_000_00);
  });

  it("does not steal a sibling's bank hit when probing already-funded", () => {
    const hyra = item({
      id: "hyra",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 10_000_00,
      cadence: "monthly",
      nextDueAt: "2026-08-25T12:00:00.000Z",
    });
    const el = item({
      id: "el",
      name: "El",
      kind: "mandatory",
      amountMinor: 10_000_00,
      cadence: "monthly",
      nextDueAt: "2026-08-27T12:00:00.000Z",
    });
    const bank = tx({
      id: "sms-hyra",
      amountMinor: 10_000_00,
      direction: "debit",
      transactionType: "expense",
      description: "Hyra",
      source: "sms",
      occurredAt: "2026-08-25T09:00:00.000Z",
    });
    expect(
      planItemAlreadyFundedInLedger({
        item: el,
        planItems: [hyra, el],
        transactions: [bank],
        kind: "expense",
        monthKey: "2026-08",
        timeZone: tz,
      }),
    ).toBe(false);
    expect(
      planItemAlreadyFundedInLedger({
        item: hyra,
        planItems: [hyra, el],
        transactions: [bank],
        kind: "expense",
        monthKey: "2026-08",
        timeZone: tz,
      }),
    ).toBe(false);
  });

  it("books only the Delvis step-up", () => {
    const half = previewPlanSettleEffect({
      item: { ...csn, settledMinor: 20_000_00 },
      targetBookedMinor: 57_000_00,
      transactions: [],
      timeZone: tz,
    });
    expect(half?.saldoDeltaMinor).toBe(37_000_00);
    expect(half?.incomingDeltaMinor).toBe(-37_000_00);
  });
});
