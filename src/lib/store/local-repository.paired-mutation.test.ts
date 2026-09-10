import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyStore, LOCAL_DEMO_USER_ID, type NumaStoreData } from "./types";

const storeState = vi.hoisted(() => ({
  data: createEmptyStore(),
}));

vi.mock("./local-store", () => ({
  readStore: async () => structuredClone(storeState.data),
  updateStore: async (mutator: (data: NumaStoreData) => void) => {
    const next = structuredClone(storeState.data);
    mutator(next);
    storeState.data = next;
    return next;
  },
}));

import { createCashWithdrawal, createTransfer } from "./local-repository";

const BANK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CASH_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MUTATION_ID = "11111111-1111-4111-8111-111111111111";

function account(partial: {
  id: string;
  name: string;
  accountType: "checking" | "cash";
}) {
  return {
    id: partial.id,
    userId: LOCAL_DEMO_USER_ID,
    name: partial.name,
    institution: null,
    accountType: partial.accountType,
    kind: partial.accountType === "cash" ? ("cash" as const) : ("thai_bank" as const),
    currency: "THB" as const,
    maskedIdentifier: null,
    isActive: true,
    isDefault: partial.accountType === "checking",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("local paired money-move idempotency", () => {
  beforeEach(() => {
    storeState.data = createEmptyStore();
    storeState.data.accounts = [
      account({ id: BANK_ID, name: "Bank", accountType: "checking" }),
      account({ id: CASH_ID, name: "Kontanter", accountType: "cash" }),
    ];
  });

  it("writes one transfer pair and replays the same mutation id", async () => {
    const first = await createTransfer({
      fromAccountId: BANK_ID,
      toAccountId: CASH_ID,
      amountMinor: 250_00,
      clientMutationId: MUTATION_ID,
    });
    expect(first.out.direction).toBe("debit");
    expect(first.inn.direction).toBe("credit");
    expect(first.out.transferGroupId).toBe(first.inn.transferGroupId);
    expect(first.out.clientMutationId).toBe(MUTATION_ID);
    expect(first.inn.clientMutationId).toBeNull();
    expect(first.out.transactionType).toBe("transfer");

    const retry = await createTransfer({
      fromAccountId: BANK_ID,
      toAccountId: CASH_ID,
      amountMinor: 250_00,
      clientMutationId: MUTATION_ID,
    });
    expect(retry.out.id).toBe(first.out.id);
    expect(retry.inn.id).toBe(first.inn.id);
    expect(storeState.data.transactions).toHaveLength(2);
  });

  it("writes one cash withdrawal pair and replays the same mutation id", async () => {
    const first = await createCashWithdrawal({
      fromAccountId: BANK_ID,
      toAccountId: CASH_ID,
      amountMinor: 80_00,
      clientMutationId: MUTATION_ID,
    });
    expect(first.out.transactionType).toBe("cash_withdrawal");
    expect(first.inn.transactionType).toBe("cash_withdrawal");
    expect(first.out.clientMutationId).toBe(MUTATION_ID);
    expect(first.inn.clientMutationId).toBeNull();
    expect(first.out.transferGroupId).toBe(first.inn.transferGroupId);

    const retry = await createCashWithdrawal({
      fromAccountId: BANK_ID,
      toAccountId: CASH_ID,
      amountMinor: 80_00,
      clientMutationId: MUTATION_ID,
    });
    expect(retry.out.id).toBe(first.out.id);
    expect(storeState.data.transactions).toHaveLength(2);
  });

  it("refuses to insert a second transfer when the stored pair is incomplete", async () => {
    storeState.data.transactions = [
      {
        id: "orphan-debit",
        userId: LOCAL_DEMO_USER_ID,
        accountId: BANK_ID,
        counterAccountId: CASH_ID,
        direction: "debit",
        transactionType: "transfer",
        amountMinor: 250_00,
        currency: "THB",
        clientMutationId: MUTATION_ID,
        occurredAt: "2026-01-01T00:00:00.000Z",
        description: "Överföring",
        merchant: null,
        category: null,
        source: "manual",
        status: "confirmed",
        balanceAfterMinor: null,
        fingerprint: null,
        sourceObservationId: null,
        transferGroupId: "broken-group",
        syncStatus: "saved",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    await expect(
      createTransfer({
        fromAccountId: BANK_ID,
        toAccountId: CASH_ID,
        amountMinor: 250_00,
        clientMutationId: MUTATION_ID,
      }),
    ).rejects.toThrow("Överföringen sparades inte komplett");
    expect(storeState.data.transactions).toHaveLength(1);
  });
});
