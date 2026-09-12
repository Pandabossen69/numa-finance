import { describe, expect, it } from "vitest";
import { buildMovementsSnapshot } from "@/features/finance/load-movements";
import { movementsSnapshotFromToday } from "@/features/finance/snapshot-from-today";
import {
  applyMovementsEdit,
  clearClientSessionCaches,
  lastMovementsSnapshot,
  rememberMovementsSnapshot,
} from "@/features/home/last-snapshot";
import { assembleTodaySnapshot } from "@/lib/store/assemble-today-snapshot";
import {
  lockFxAtWrite,
  nativeToThbMinor,
  projectLedgerToCanonicalThb,
  spendingCategoriesByMonthKey,
  thbToNativeMinor,
  toCanonicalThbTransaction,
} from "./index";
import type { Account, BalanceCheckpoint, CanonicalTransaction, Profile } from "./types";

const tz = "Asia/Bangkok";
const now = new Date("2026-09-04T08:00:00.000Z");

function account(
  partial: Pick<Account, "id" | "name" | "kind" | "currency"> & Partial<Account>,
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
    category: null,
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

const thbAccount = account({
  id: "bank",
  name: "Bangkok Bank",
  kind: "thai_bank",
  currency: "THB",
  isDefault: true,
});
const sekAccount = account({
  id: "nordea",
  name: "Nordea",
  kind: "swedish_bank",
  currency: "SEK",
});

describe("native / canonical currency boundary", () => {
  it("locks 10 SEK at 3.5 as 35 THB and the inverse", () => {
    const locked = lockFxAtWrite({
      nativeMinor: 10_00,
      currency: "SEK",
      checkpoint: { fxRate: 3.5 },
      nowIso: "2026-09-04T08:00:00.000Z",
    });
    expect(locked).toEqual({
      thbMinor: 35_00,
      fxRate: 3.5,
      fxAsOf: "2026-09-04T08:00:00.000Z",
      fxSource: "transaction",
    });
    expect(nativeToThbMinor(10_00, "SEK", 3.5)).toBe(35_00);
    expect(thbToNativeMinor(20_000_00, "SEK", 3.5)).toBe(5_714_29);
    expect(thbToNativeMinor(20_000_00, "SEK", 3.5)).not.toBe(20_000_00);
  });

  it("creates, edits and reloads a THB expense as 10 THB", () => {
    const created = tx({
      id: "thb-10",
      accountId: "bank",
      amountMinor: 10_00,
      thbMinor: 10_00,
      fxRate: 1,
      occurredAt: "2026-09-04T03:00:00.000Z",
      description: "Lunch",
    });
    const first = buildMovementsSnapshot({
      accounts: [thbAccount],
      transactions: [created],
      checkpoints: [checkpoint("bank", 50_000_00)],
      timeZone: tz,
      now,
    });
    expect(first.items[0]?.nativeAmountMinor).toBe(10_00);
    expect(first.items[0]?.nativeCurrency).toBe("THB");
    expect(first.items[0]?.amountMinor).toBe(10_00);
    expect(first.items[0]?.currency).toBe("THB");

    clearClientSessionCaches();
    rememberMovementsSnapshot(first);
    applyMovementsEdit("thb-10", {
      amountMinor: 12_00,
      nativeAmountMinor: 12_00,
      description: "Lunch",
    });
    expect(lastMovementsSnapshot()?.items[0]?.nativeAmountMinor).toBe(12_00);
    expect(lastMovementsSnapshot()?.items[0]?.amountMinor).toBe(12_00);

    const reloaded = buildMovementsSnapshot({
      accounts: [thbAccount],
      transactions: [
        {
          ...created,
          amountMinor: 12_00,
          thbMinor: 12_00,
          description: "Lunch",
        },
      ],
      checkpoints: [checkpoint("bank", 50_000_00)],
      timeZone: tz,
      now,
    });
    expect(reloaded.items[0]?.nativeAmountMinor).toBe(12_00);
    expect(reloaded.items[0]?.amountMinor).toBe(12_00);
  });

  it("keeps 10 SEK @ 3.5 as 10 SEK / 35 THB after edit, navigation and reload", () => {
    const created = tx({
      id: "sek-10",
      accountId: "nordea",
      amountMinor: 10_00,
      currency: "SEK",
      thbMinor: 35_00,
      fxRate: 3.5,
      occurredAt: "2026-09-04T05:00:00.000Z",
      description: "ICA",
    });
    const first = buildMovementsSnapshot({
      accounts: [sekAccount],
      transactions: [created],
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
    expect(first.items[0]?.nativeAmountMinor).toBe(10_00);
    expect(first.items[0]?.nativeCurrency).toBe("SEK");
    expect(first.items[0]?.amountMinor).toBe(35_00);
    expect(first.items[0]?.currency).toBe("THB");

    clearClientSessionCaches();
    rememberMovementsSnapshot(first);
    applyMovementsEdit("sek-10", {
      amountMinor: 12_00,
      nativeAmountMinor: 12_00,
      description: "ICA",
    });
    const edited = lastMovementsSnapshot()?.items[0];
    expect(edited?.nativeAmountMinor).toBe(12_00);
    expect(edited?.nativeCurrency).toBe("SEK");
    expect(edited?.amountMinor).toBe(42_00);

    const laterRate = checkpoint("nordea", 1_000_00, {
      currency: "SEK",
      fxRate: 4,
      thbMinor: 4_000_00,
    });
    const reloaded = buildMovementsSnapshot({
      accounts: [sekAccount],
      transactions: [
        {
          ...created,
          amountMinor: 12_00,
          thbMinor: 42_00,
          fxRate: 3.5,
        },
      ],
      checkpoints: [laterRate],
      timeZone: tz,
      now,
    });
    expect(reloaded.items[0]?.nativeAmountMinor).toBe(12_00);
    expect(reloaded.items[0]?.nativeCurrency).toBe("SEK");
    expect(reloaded.items[0]?.amountMinor).toBe(42_00);

    const projected = toCanonicalThbTransaction(created, new Map([["nordea", laterRate]]));
    expect(projected?.amountMinor).toBe(35_00);
    expect(created.amountMinor).toBe(10_00);
  });

  it("keeps native SEK on the Hem snapshot so Rörelser edit does not prefill THB", () => {
    const created = tx({
      id: "sek-10",
      accountId: "nordea",
      amountMinor: 10_00,
      currency: "SEK",
      thbMinor: 35_00,
      fxRate: 3.5,
      occurredAt: "2026-09-04T05:00:00.000Z",
      description: "SEK kaffe",
    });
    const profile: Profile = {
      id: "u1",
      displayName: "Hugo",
      timezone: tz,
      primaryCurrency: "THB",
      referenceCurrency: "THB",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      onboardingSaldoAt: "2026-08-01T00:00:00.000Z",
      onboardingCompletedAt: "2026-08-01T00:00:00.000Z",
      gettingStartedCompletedAt: null,
      gettingStartedCollapsed: false,
    };
    const cp = checkpoint("nordea", 1_000_00, {
      currency: "SEK",
      fxRate: 3.5,
      thbMinor: 3_500_00,
    });
    const snap = assembleTodaySnapshot({
      profile,
      accounts: [sekAccount],
      planItems: [],
      primary: sekAccount,
      checkpoint: cp,
      checkpoints: [cp],
      transactions: [created],
      now,
    });
    expect(snap.ledgerTransactions[0]?.amountMinor).toBe(10_00);
    expect(snap.ledgerTransactions[0]?.currency).toBe("SEK");
    expect(snap.ledgerTransactions[0]?.thbMinor).toBe(35_00);

    const movements = movementsSnapshotFromToday(snap, now);
    expect(movements.items[0]?.nativeAmountMinor).toBe(10_00);
    expect(movements.items[0]?.nativeCurrency).toBe("SEK");
    expect(movements.items[0]?.amountMinor).toBe(35_00);
  });

  it("keeps Analys Per kategori on canonical THB so SEK spend cannot drift from Spenderat", () => {
    // Confirmed root cause (test@): 112 THB = 32 SEK × 3.5 from four confirmed
    // SEK expenses (10+20+1+1). Not transfer / excluded category. FX is app-side
    // (tx.thbMinor / checkpoint rate) — numa.fx_conversions empty. Native
    // Per kategori skipped currency !== THB → 38 712 vs Spenderat 38 824.
    const thbSpend = tx({
      id: "thb-big",
      accountId: "bank",
      amountMinor: 38_712_00,
      thbMinor: 38_712_00,
      fxRate: 1,
      category: "Mat",
      occurredAt: "2026-09-02T03:00:00.000Z",
    });
    const sekParts = [
      { id: "sek-10", amountMinor: 10_00, thbMinor: 35_00, at: "2026-09-03T05:00:00.000Z" },
      { id: "sek-20", amountMinor: 20_00, thbMinor: 70_00, at: "2026-09-04T05:00:00.000Z" },
      { id: "sek-1a", amountMinor: 1_00, thbMinor: 3_50, at: "2026-09-05T05:00:00.000Z" },
      { id: "sek-1b", amountMinor: 1_00, thbMinor: 3_50, at: "2026-09-06T05:00:00.000Z", category: null },
    ] as const;
    const sekSpend = sekParts.map((part) =>
      tx({
        id: part.id,
        accountId: "nordea",
        amountMinor: part.amountMinor,
        currency: "SEK",
        thbMinor: part.thbMinor,
        fxRate: 3.5,
        category: "category" in part ? part.category : "Övrigt",
        occurredAt: part.at,
      }),
    );
    const profile: Profile = {
      id: "u1",
      displayName: "Hugo",
      timezone: tz,
      primaryCurrency: "THB",
      referenceCurrency: "THB",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      onboardingSaldoAt: "2026-08-01T00:00:00.000Z",
      onboardingCompletedAt: "2026-08-01T00:00:00.000Z",
      gettingStartedCompletedAt: null,
      gettingStartedCollapsed: false,
    };
    const thbCp = checkpoint("bank", 100_000_00);
    const sekCp = checkpoint("nordea", 1_000_00, {
      currency: "SEK",
      fxRate: 3.5,
      thbMinor: 3_500_00,
    });
    const snap = assembleTodaySnapshot({
      profile,
      accounts: [thbAccount, sekAccount],
      planItems: [],
      primary: thbAccount,
      checkpoint: thbCp,
      checkpoints: [thbCp, sekCp],
      transactions: [thbSpend, ...sekSpend],
      now,
    });

    expect(snap.monthSpendingByKey["2026-09"]).toBe(38_824_00);

    const byId = new Map(
      (snap.accountBalances ?? []).map((row) => [row.accountId, row]),
    );
    const fxMap = new Map(
      snap.accounts.map((account) => {
        const bal = byId.get(account.id);
        return [
          account.id,
          bal
            ? {
                accountId: account.id,
                balanceMinor: bal.nativeMinor ?? 0,
                thbMinor: bal.thbMinor,
                fxRate: bal.fxRate,
              }
            : null,
        ] as const;
      }),
    );

    const nativeCategories = spendingCategoriesByMonthKey({
      transactions: snap.ledgerTransactions,
      currency: "THB",
      timeZone: tz,
    })["2026-09"];
    const nativeSum =
      nativeCategories?.reduce((n, row) => n + row.amountMinor, 0) ?? 0;
    expect(nativeSum).toBe(38_712_00);

    const canonicalCategories = spendingCategoriesByMonthKey({
      transactions: projectLedgerToCanonicalThb(snap.ledgerTransactions, fxMap),
      currency: "THB",
      timeZone: tz,
    })["2026-09"];
    const categorySum =
      canonicalCategories?.reduce((n, row) => n + row.amountMinor, 0) ?? 0;
    expect(categorySum).toBe(38_824_00);
    expect(categorySum).toBe(snap.monthSpendingByKey["2026-09"]);
    expect(canonicalCategories?.some((c) => c.name === "Övrigt")).toBe(true);
    // QA fixture: four SEK rows land under Övrigt (Tx shows Övrigt 8× when
    // other uncategorised THB spend is included — here the null-cat SEK row
    // must appear after FX, not vanish).
    const uncategorised = canonicalCategories?.find((c) => c.name === "Övrigt");
    expect(uncategorised?.count).toBe(1);
    expect(uncategorised?.amountMinor).toBe(3_50);

    const movements = movementsSnapshotFromToday(snap, now);
    expect(movements.monthExpenseMinor).toBe(38_824_00);

    // Senaste / Tx list: same four SEK rows show as THB after projection.
    const projected = projectLedgerToCanonicalThb(snap.ledgerTransactions, fxMap);
    const sekProjected = projected.filter((tx) =>
      sekParts.some((part) => part.id === tx.id),
    );
    expect(sekProjected).toHaveLength(4);
    expect(sekProjected.every((tx) => tx.currency === "THB")).toBe(true);
    expect(sekProjected.map((tx) => tx.amountMinor).sort((a, b) => a - b)).toEqual(
      [3_50, 3_50, 35_00, 70_00],
    );
  });
});
