import { describe, expect, it } from "vitest";
import {
  amountToThbMinor,
  projectLedgerToCanonicalThb,
  toCanonicalThbTransaction,
} from "./canonical-thb";
import type { BalanceCheckpoint, CanonicalTransaction } from "./types";

const sekCheckpoint: BalanceCheckpoint = {
  id: "cp-sek",
  userId: "u1",
  accountId: "sek-1",
  balanceMinor: 1_000_00,
  currency: "SEK",
  thbMinor: 3_200_00,
  fxRate: 3.2,
  fxAsOf: "2026-08-26T00:00:00.000Z",
  fxSource: "manual",
  verifiedAt: "2026-08-26T00:00:00.000Z",
  source: "manual",
  sourceObservationId: null,
  note: null,
  createdAt: "2026-08-26T00:00:00.000Z",
};

describe("canonical THB conversion", () => {
  it("leaves THB amounts unchanged", () => {
    expect(amountToThbMinor(88_00, "THB", null)).toBe(88_00);
  });

  it("converts SEK with the locked checkpoint rate", () => {
    expect(amountToThbMinor(100_00, "SEK", sekCheckpoint)).toBe(320_00);
  });

  it("returns null when a non-THB amount has no usable rate", () => {
    expect(amountToThbMinor(100_00, "SEK", null)).toBeNull();
  });

  it("projects a SEK expense into a THB ledger row for spend totals", () => {
    const tx: CanonicalTransaction = {
      id: "sek-spend",
      userId: "u1",
      accountId: "sek-1",
      counterAccountId: null,
      direction: "debit",
      transactionType: "expense",
      amountMinor: 50_00,
      currency: "SEK",
      occurredAt: "2026-08-26T08:00:00.000Z",
      description: "Fika",
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
      createdAt: "2026-08-26T08:00:00.000Z",
      updatedAt: "2026-08-26T08:00:00.000Z",
    };
    const map = new Map([["sek-1", sekCheckpoint]]);
    const projected = toCanonicalThbTransaction(tx, map);
    expect(projected?.currency).toBe("THB");
    expect(projected?.amountMinor).toBe(160_00);
    const all = projectLedgerToCanonicalThb([tx], map);
    expect(all).toHaveLength(1);
    expect(all[0]?.amountMinor).toBe(160_00);
  });

  it("keeps the locked THB amount when the live account rate changes", () => {
    const locked: CanonicalTransaction = {
      id: "sek-10",
      userId: "u1",
      accountId: "sek-1",
      counterAccountId: null,
      direction: "debit",
      transactionType: "expense",
      amountMinor: 10_00,
      currency: "SEK",
      thbMinor: 35_00,
      fxRate: 3.5,
      occurredAt: "2026-08-26T08:00:00.000Z",
      description: "ICA",
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
      createdAt: "2026-08-26T08:00:00.000Z",
      updatedAt: "2026-08-26T08:00:00.000Z",
    };
    const later: BalanceCheckpoint = {
      ...sekCheckpoint,
      fxRate: 4,
      thbMinor: 4_000_00,
    };
    const projected = toCanonicalThbTransaction(locked, new Map([["sek-1", later]]));
    expect(projected?.amountMinor).toBe(35_00);
    expect(locked.amountMinor).toBe(10_00);
  });
});
