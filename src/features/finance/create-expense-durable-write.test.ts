import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  createIncome: vi.fn(),
  profile: vi.fn(),
  reclaim: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/store/repository", () => ({
  archiveAccount: vi.fn(),
  createAccount: vi.fn(),
  createCashWithdrawal: vi.fn(),
  createCheckpoint: vi.fn(),
  createManualExpense: mocks.createExpense,
  createManualIncome: mocks.createIncome,
  createTransfer: vi.fn(),
  deleteAccount: vi.fn(),
  ensureDefaultBankAccount: vi.fn(),
  getProfile: mocks.profile,
  restoreAccount: vi.fn(),
  stampOnboardingCompletedAt: vi.fn(),
  stampOnboardingSaldoAt: vi.fn(),
  updateAccount: vi.fn(),
  updateTransaction: vi.fn(),
  voidTransaction: vi.fn(),
  refreshTodaySnapshot: mocks.refresh,
}));
vi.mock("@/features/plan/sync-settle-ledger", () => ({
  reclaimStalePlanSettleLedgers: mocks.reclaim,
}));
vi.mock("@/lib/observe/report", () => ({ reportError: vi.fn() }));

import { createExpenseAction, createIncomeAction } from "./actions";

const MUTATION_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function expenseInput() {
  return {
    accountId: ACCOUNT_ID,
    amount: "100",
    description: "Kaffe",
    clientMutationId: MUTATION_ID,
  };
}

describe("durable expense/income write vs post-write refresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const ledger: Array<{ id: string; clientMutationId: string | null }> = [];
    mocks.createExpense.mockImplementation(
      async (input: { clientMutationId?: string | null }) => {
        const existing = ledger.find(
          (row) =>
            input.clientMutationId &&
            row.clientMutationId === input.clientMutationId,
        );
        if (existing) return existing;
        const tx = { id: "tx-expense-1", clientMutationId: input.clientMutationId ?? null };
        ledger.push(tx);
        return tx;
      },
    );
    mocks.createIncome.mockImplementation(
      async (input: { clientMutationId?: string | null }) => {
        const existing = ledger.find(
          (row) =>
            input.clientMutationId &&
            row.clientMutationId === input.clientMutationId,
        );
        if (existing) return existing;
        const tx = { id: "tx-income-1", clientMutationId: input.clientMutationId ?? null };
        ledger.push(tx);
        return tx;
      },
    );
    mocks.profile.mockRejectedValue(new Error("profile offline"));
    mocks.refresh.mockResolvedValue({});
  });

  it("reports saved + refresh pending when the write committed and cleanup throws", async () => {
    const result = await createExpenseAction(expenseInput());
    expect(result).toMatchObject({
      ok: true,
      id: "tx-expense-1",
      refreshPending: true,
      refreshPendingMessage: "Sparat. Uppdaterar siffrorna…",
    });
    expect(mocks.createExpense).toHaveBeenCalledOnce();
  });

  it("retries the same mutation id without a second economic effect", async () => {
    const first = await createExpenseAction(expenseInput());
    const second = await createExpenseAction(expenseInput());
    expect(first).toMatchObject({ ok: true, id: "tx-expense-1", refreshPending: true });
    expect(second).toMatchObject({ ok: true, id: "tx-expense-1", refreshPending: true });
    expect(mocks.createExpense).toHaveBeenCalledTimes(2);
    const firstArg = mocks.createExpense.mock.calls[0]?.[0] as {
      clientMutationId?: string;
    };
    const secondArg = mocks.createExpense.mock.calls[1]?.[0] as {
      clientMutationId?: string;
    };
    expect(firstArg.clientMutationId).toBe(MUTATION_ID);
    expect(secondArg.clientMutationId).toBe(MUTATION_ID);
    expect(first.ok && second.ok && first.id === second.id).toBe(true);
  });

  it("still fails when the durable write itself fails", async () => {
    mocks.createExpense.mockRejectedValue(new Error("ledger down"));
    await expect(createExpenseAction(expenseInput())).resolves.toEqual({
      ok: false,
      error: "ledger down",
    });
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("applies the same invariant to income", async () => {
    const result = await createIncomeAction({
      accountId: ACCOUNT_ID,
      amount: "250",
      description: "Lön",
      clientMutationId: MUTATION_ID,
    });
    expect(result).toMatchObject({
      ok: true,
      id: "tx-income-1",
      refreshPending: true,
    });
  });
});
