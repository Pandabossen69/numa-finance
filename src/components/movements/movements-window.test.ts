import { describe, expect, it } from "vitest";
import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import {
  cycleWindowTotals,
  movementVisibleInRorelser,
  payCycleRangeLabelSv,
  type MovementsWindow,
} from "./movements-window";

const CYCLE_START = "2026-09-03T00:00:00.000Z";
const CYCLE_END = "2026-10-25T00:00:00.000Z";

type Row = {
  id: string;
  transactionType: string;
  direction: "debit" | "credit";
  category: string | null;
  occurredAt: string;
  amountMinor: number;
};

function row(partial: Partial<Row> & Pick<Row, "id" | "occurredAt">): Row {
  return {
    transactionType: "expense",
    direction: "debit",
    category: null,
    amountMinor: 100,
    ...partial,
  };
}

function windowOf(partial: Partial<MovementsWindow> = {}): MovementsWindow {
  return {
    filter: "expense",
    period: "cycle",
    category: UNCATEGORISED_SPEND_NAME,
    monthKey: "2026-09",
    timeZone: "Asia/Bangkok",
    cycleStartAt: CYCLE_START,
    cycleEndAt: CYCLE_END,
    ...partial,
  };
}

describe("movementVisibleInRorelser", () => {
  const items = [
    ...Array.from({ length: 9 }, (_, index) =>
      row({
        id: `in-${index}`,
        occurredAt:
          index === 0
            ? CYCLE_START
            : `2026-09-${String(10 + index).padStart(2, "0")}T04:00:00.000Z`,
      }),
    ),
    ...Array.from({ length: 13 }, (_, index) =>
      row({
        id: `out-${index}`,
        occurredAt: index === 0 ? CYCLE_END : "2026-08-01T04:00:00.000Z",
      }),
    ),
    row({
      id: "income-in-window",
      transactionType: "income",
      direction: "credit",
      occurredAt: "2026-09-12T04:00:00.000Z",
      amountMinor: 50_000,
    }),
    row({
      id: "mat",
      category: "Mat",
      occurredAt: "2026-09-15T04:00:00.000Z",
    }),
  ];

  it("keeps the Analys pay-cycle Övrigt count and drops income", () => {
    const visible = items.filter((tx) =>
      movementVisibleInRorelser(tx, windowOf()),
    );
    expect(visible.map((tx) => tx.id)).toEqual(
      Array.from({ length: 9 }, (_, index) => `in-${index}`),
    );
    expect(visible.some((tx) => tx.transactionType === "income")).toBe(false);
  });

  it("uses the whole ledger on All tid even when cycle bounds are stored", () => {
    const visible = items.filter((tx) =>
      movementVisibleInRorelser(tx, windowOf({ period: "all" })),
    );
    expect(visible.some((tx) => tx.id === "out-0")).toBe(true);
    expect(visible.some((tx) => tx.id === "income-in-window")).toBe(false);
  });

  it("keeps Denna månad on the calendar month and ignores the cycle window", () => {
    const september = row({
      id: "sept",
      occurredAt: "2026-09-02T04:00:00.000Z",
    });
    const october = row({
      id: "oct",
      occurredAt: "2026-10-02T04:00:00.000Z",
    });
    const opts = windowOf({ period: "month", category: null });
    expect(movementVisibleInRorelser(september, opts)).toBe(true);
    expect(movementVisibleInRorelser(october, opts)).toBe(false);
  });
});

describe("cycleWindowTotals", () => {
  it("sums income and expense debits inside the half-open window", () => {
    const totals = cycleWindowTotals(
      [
        row({ id: "spend", occurredAt: "2026-09-10T04:00:00.000Z", amountMinor: 400 }),
        row({
          id: "income",
          transactionType: "income",
          direction: "credit",
          occurredAt: "2026-09-11T04:00:00.000Z",
          amountMinor: 1_000,
        }),
        row({
          id: "credit-expense",
          direction: "credit",
          occurredAt: "2026-09-12T04:00:00.000Z",
          amountMinor: 50,
        }),
        row({ id: "outside", occurredAt: "2026-08-01T04:00:00.000Z", amountMinor: 9_000 }),
        row({ id: "end", occurredAt: CYCLE_END, amountMinor: 7 }),
      ],
      CYCLE_START,
      CYCLE_END,
    );
    expect(totals).toEqual({
      incomeMinor: 1_000,
      expenseMinor: 400,
      netMinor: 600,
    });
  });
});

describe("payCycleRangeLabelSv", () => {
  it("prints the cycle as a Swedish range", () => {
    const label = payCycleRangeLabelSv(
      "2026-09-02T17:00:00.000Z",
      "2026-10-24T17:00:00.000Z",
      "Asia/Bangkok",
    );
    expect(label?.toLowerCase()).toContain("sep");
    expect(label?.toLowerCase()).toContain("okt");
    expect(label).toContain("–");
    expect(payCycleRangeLabelSv(null, CYCLE_END, "Asia/Bangkok")).toBeNull();
  });
});
