import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildMovementsSnapshot,
  mergeMovementNativeFromServer,
  movementEditPrefill,
} from "./load-movements";
import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
} from "@/domain/finance";

const src = readFileSync(new URL("./load-movements.ts", import.meta.url), "utf8");

const now = new Date("2026-09-04T08:00:00.000Z");
const tz = "Asia/Bangkok";

function account(
  partial: Pick<Account, "id" | "name" | "kind" | "currency"> &
    Partial<Account>,
): Account {
  return {
    userId: "u1",
    institution: null,
    accountType: partial.kind === "cash" ? "cash" : "checking",
    maskedIdentifier: null,
    isActive: true,
    isDefault: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

function checkpoint(
  accountId: string,
  balanceMinor: number,
  extra: Partial<BalanceCheckpoint> = {},
): BalanceCheckpoint {
  const currency = extra.currency ?? "THB";
  return {
    id: `cp-${accountId}`,
    userId: "u1",
    accountId,
    balanceMinor,
    currency,
    thbMinor:
      extra.thbMinor ??
      (currency === "THB"
        ? balanceMinor
        : extra.fxRate
          ? Math.round(balanceMinor * extra.fxRate)
          : null),
    fxRate: extra.fxRate ?? (currency === "THB" ? 1 : null),
    fxAsOf: extra.fxAsOf ?? "2026-09-01T00:00:00.000Z",
    fxSource: extra.fxSource ?? (currency === "THB" ? "identity" : "manual"),
    verifiedAt: "2026-09-01T00:00:00.000Z",
    source: "manual",
    sourceObservationId: null,
    note: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  };
}

function tx(
  partial: Partial<CanonicalTransaction> &
    Pick<CanonicalTransaction, "id" | "accountId" | "amountMinor" | "occurredAt">,
): CanonicalTransaction {
  return {
    userId: "u1",
    counterAccountId: null,
    direction: "debit",
    transactionType: "expense",
    currency: "THB",
    description: partial.description ?? "köp",
    merchant: null,
    category: partial.category ?? null,
    source: "manual",
    status: "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    transferGroupId: null,
    planItemId: null,
    ledgerOrigin: "external",
    linkedPlanItemId: null,
    syncStatus: "saved",
    createdAt: partial.occurredAt,
    updatedAt: partial.occurredAt,
    ...partial,
  };
}

const primary = account({
  id: "bank",
  name: "Bangkok Bank",
  kind: "thai_bank",
  currency: "THB",
  isDefault: true,
});
const cash = account({
  id: "cash",
  name: "Kontanter",
  kind: "cash",
  currency: "THB",
});
const sek = account({
  id: "nordea",
  name: "Nordea",
  kind: "swedish_bank",
  currency: "SEK",
});

describe("loadMovementsSnapshot", () => {
  it("does not pull the full Hem snapshot for Rörelser", () => {
    expect(src).not.toContain("getCachedTodaySnapshot");
    expect(src).not.toMatch(/from ["']@\/features\/finance\/load-home["']/);
    expect(src).not.toContain("getTodaySnapshot");
    expect(src).toContain("listTransactions");
    expect(src).toContain("buildMovementsSnapshot");
    expect(src).toContain("projectLedgerToCanonicalThb");
    expect(src).not.toContain("t.accountId === primary.id");
  });
});

describe("buildMovementsSnapshot", () => {
  it("includes cash and SEK rows and converts totals to THB", () => {
    const lunch = tx({
      id: "lunch",
      accountId: "bank",
      amountMinor: 1_200_00,
      occurredAt: "2026-09-04T03:00:00.000Z",
      description: "Lunch",
    });
    const coffee = tx({
      id: "coffee",
      accountId: "cash",
      amountMinor: 88_00,
      occurredAt: "2026-09-04T04:00:00.000Z",
      description: "Kaffe",
    });
    const sweden = tx({
      id: "sek-exp",
      accountId: "nordea",
      amountMinor: 100_00,
      currency: "SEK",
      occurredAt: "2026-09-04T05:00:00.000Z",
      description: "ICA",
    });
    const view = buildMovementsSnapshot({
      accounts: [primary, cash, sek],
      transactions: [lunch, coffee, sweden],
      checkpoints: [
        checkpoint("bank", 50_000_00),
        checkpoint("cash", 2_000_00),
        checkpoint("nordea", 1_000_00, {
          currency: "SEK",
          fxRate: 3.2,
          thbMinor: 3_200_00,
        }),
      ],
      timeZone: tz,
      now,
    });

    expect(view.items.map((row) => row.id).sort()).toEqual([
      "coffee",
      "lunch",
      "sek-exp",
    ]);
    expect(view.monthExpenseMinor).toBe(1_200_00 + 88_00 + 320_00);
    expect(view.items.find((row) => row.id === "coffee")?.amountMinor).toBe(88_00);
    expect(view.items.find((row) => row.id === "sek-exp")?.amountMinor).toBe(320_00);
    expect(view.items.find((row) => row.id === "sek-exp")?.currency).toBe("THB");
    expect(view.items.find((row) => row.id === "sek-exp")?.nativeAmountMinor).toBe(100_00);
    expect(view.items.find((row) => row.id === "sek-exp")?.nativeCurrency).toBe("SEK");
    expect(view.balanceMinor).toBe(50_000_00 - 1_200_00 + 2_000_00 - 88_00 + 3_200_00 - 320_00);
  });

  it("lists transfers without counting them as spend", () => {
    const view = buildMovementsSnapshot({
      accounts: [primary, cash],
      transactions: [
        tx({
          id: "xfer",
          accountId: "bank",
          counterAccountId: "cash",
          amountMinor: 500_00,
          occurredAt: "2026-09-04T06:00:00.000Z",
          transactionType: "transfer",
          description: "Uttag",
        }),
      ],
      checkpoints: [checkpoint("bank", 50_000_00), checkpoint("cash", 2_000_00)],
      timeZone: tz,
      now,
    });
    expect(view.items).toHaveLength(1);
    expect(view.monthExpenseMinor).toBe(0);
    expect(view.allExpenseMinor).toBe(0);
  });
});

describe("movementEditPrefill", () => {
  it("prefills native SEK when the row still has native fields", () => {
    expect(
      movementEditPrefill({
        amountMinor: 70_00,
        currency: "THB",
        nativeAmountMinor: 20_00,
        nativeCurrency: "SEK",
        fxRate: 3.5,
      }),
    ).toEqual({ amountMinor: 20_00, currency: "SEK" });
  });

  it("recovers 20 SEK from 70 THB when a stale cache copied THB into native", () => {
    expect(
      movementEditPrefill(
        {
          amountMinor: 70_00,
          currency: "THB",
          nativeAmountMinor: 70_00,
          nativeCurrency: "THB",
          fxRate: 3.5,
        },
        "SEK",
      ),
    ).toEqual({ amountMinor: 20_00, currency: "SEK" });
  });
});

describe("mergeMovementNativeFromServer", () => {
  it("restores native booking on dirty client rows from the server snapshot", () => {
    const stale = {
      currency: "THB" as const,
      hasBankTruth: true,
      balanceMinor: 0,
      monthIncomeMinor: 0,
      monthExpenseMinor: 70_00,
      monthNetMinor: -70_00,
      allIncomeMinor: 0,
      allExpenseMinor: 70_00,
      allNetMinor: -70_00,
      monthCategories: [],
      timeZone: tz,
      monthKey: "2026-09",
      items: [
        {
          id: "sek-exp",
          description: "SEK kaffe",
          category: null,
          transactionType: "expense",
          direction: "debit" as const,
          amountMinor: 70_00,
          currency: "THB" as const,
          nativeAmountMinor: 70_00,
          nativeCurrency: "THB" as const,
          accountId: "nordea",
          fxRate: 3.5,
          occurredAt: "2026-09-04T05:00:00.000Z",
          source: "manual",
        },
      ],
    };
    const fresh = buildMovementsSnapshot({
      accounts: [sek],
      transactions: [
        tx({
          id: "sek-exp",
          accountId: "nordea",
          amountMinor: 20_00,
          currency: "SEK",
          thbMinor: 70_00,
          fxRate: 3.5,
          occurredAt: "2026-09-04T05:00:00.000Z",
          description: "SEK kaffe",
        }),
      ],
      checkpoints: [
        checkpoint("nordea", 1_000_00, {
          currency: "SEK",
          fxRate: 3.5,
          thbMinor: 3_500_00,
        }),
      ],
      timeZone: tz,
      now,
    });
    const merged = mergeMovementNativeFromServer(stale, fresh);
    expect(merged.items[0]?.nativeAmountMinor).toBe(20_00);
    expect(merged.items[0]?.nativeCurrency).toBe("SEK");
    expect(merged.items[0]?.amountMinor).toBe(70_00);
  });
});
