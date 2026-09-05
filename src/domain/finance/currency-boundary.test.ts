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
});
