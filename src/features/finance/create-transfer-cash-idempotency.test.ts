import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requireCompletePairedReplay,
  type CanonicalTransaction,
} from "@/domain/finance";

const mocks = vi.hoisted(() => ({
  createTransfer: vi.fn(),
  createCash: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/store/repository", () => ({
  archiveAccount: vi.fn(),
  createAccount: vi.fn(),
  createCashWithdrawal: mocks.createCash,
  createCheckpoint: vi.fn(),
  createManualExpense: vi.fn(),
  createManualIncome: vi.fn(),
  createTransfer: mocks.createTransfer,
  deleteAccount: vi.fn(),
  ensureDefaultBankAccount: vi.fn(),
  getProfile: vi.fn(),
  restoreAccount: vi.fn(),
  stampOnboardingCompletedAt: vi.fn(),
  stampOnboardingSaldoAt: vi.fn(),
  updateAccount: vi.fn(),
  updateTransaction: vi.fn(),
  voidTransaction: vi.fn(),
  refreshTodaySnapshot: mocks.refresh,
}));
vi.mock("@/features/plan/sync-settle-ledger", () => ({
  reclaimStalePlanSettleLedgers: vi.fn(),
}));
vi.mock("@/lib/observe/report", () => ({ reportError: vi.fn() }));

import {
  createCashWithdrawalAction,
  createTransferAction,
} from "./actions";

const MUTATION_ID = "11111111-1111-4111-8111-111111111111";
const FROM_ID = "22222222-2222-4222-8222-222222222222";
const TO_ID = "33333333-3333-4333-8333-333333333333";

type PairRow = Pick<
  CanonicalTransaction,
  | "id"
  | "direction"
  | "status"
  | "clientMutationId"
  | "transferGroupId"
  | "transactionType"
  | "accountId"
  | "amountMinor"
>;

function makePairedLedger() {
  const rows: PairRow[] = [];
  const inFlight = new Map<string, Promise<{ out: PairRow; inn: PairRow }>>();
  let inserts = 0;

  async function createPair(
    input: { clientMutationId?: string | null; amountMinor: number },
    transactionType: PairRow["transactionType"],
  ) {
    if (input.clientMutationId) {
      const existing = requireCompletePairedReplay(
        input.clientMutationId,
        rows,
        "Överföringen sparades inte komplett",
      );
      if (existing) return existing;
      const pending = inFlight.get(input.clientMutationId);
      if (pending) return pending;
    }

    const work = (async () => {
      await Promise.resolve();
      if (input.clientMutationId) {
        const existing = requireCompletePairedReplay(
          input.clientMutationId,
          rows,
          "Överföringen sparades inte komplett",
        );
        if (existing) return existing;
      }
      inserts += 1;
      const group = `group-${inserts}`;
      const out: PairRow = {
        id: `${transactionType}-out-${inserts}`,
        direction: "debit",
        status: "confirmed",
        clientMutationId: input.clientMutationId ?? null,
        transferGroupId: group,
        transactionType,
        accountId: FROM_ID,
        amountMinor: input.amountMinor,
      };
      const inn: PairRow = {
        id: `${transactionType}-in-${inserts}`,
        direction: "credit",
        status: "confirmed",
        clientMutationId: null,
        transferGroupId: group,
        transactionType,
        accountId: TO_ID,
        amountMinor: input.amountMinor,
      };
      rows.push(out, inn);
      return { out, inn };
    })();

    if (input.clientMutationId) {
      inFlight.set(input.clientMutationId, work);
    }
    try {
      return await work;
    } finally {
      if (input.clientMutationId) {
        inFlight.delete(input.clientMutationId);
      }
    }
  }

  return {
    rows,
    inserts: () => inserts,
    createTransfer: (input: {
      clientMutationId?: string | null;
      amountMinor: number;
    }) => createPair(input, "transfer"),
    createCash: (input: {
      clientMutationId?: string | null;
      amountMinor: number;
    }) => createPair(input, "cash_withdrawal"),
  };
}

function transferInput(amount = "250") {
  return {
    fromAccountId: FROM_ID,
    toAccountId: TO_ID,
    amount,
    description: "Hyra",
    clientMutationId: MUTATION_ID,
  };
}

function cashInput(amount = "80") {
  return {
    fromAccountId: FROM_ID,
    toAccountId: TO_ID,
    amount,
    description: "Uttag",
    clientMutationId: MUTATION_ID,
  };
}

describe("transfer idempotency", () => {
  let ledger: ReturnType<typeof makePairedLedger>;

  beforeEach(() => {
    vi.resetAllMocks();
    ledger = makePairedLedger();
    mocks.createTransfer.mockImplementation(ledger.createTransfer);
    mocks.createCash.mockImplementation(ledger.createCash);
    mocks.refresh.mockRejectedValue(new Error("snapshot offline"));
  });

  it("creates one debit, one credit, and one transfer group", async () => {
    const result = await createTransferAction(transferInput());
    expect(result).toMatchObject({
      ok: true,
      id: "transfer-out-1",
      refreshPending: true,
      refreshPendingMessage: "Sparat. Uppdaterar siffrorna…",
    });
    expect(ledger.rows).toHaveLength(2);
    expect(ledger.rows.map((row) => row.direction)).toEqual(["debit", "credit"]);
    expect(new Set(ledger.rows.map((row) => row.transferGroupId)).size).toBe(1);
    expect(ledger.rows[0]?.clientMutationId).toBe(MUTATION_ID);
    expect(ledger.rows[1]?.clientMutationId).toBeNull();
    expect(ledger.inserts()).toBe(1);
  });

  it("replays the same mutation id without a second economic effect", async () => {
    const first = await createTransferAction(transferInput());
    const second = await createTransferAction(transferInput());
    expect(first).toMatchObject({ ok: true, id: "transfer-out-1" });
    expect(second).toMatchObject({ ok: true, id: "transfer-out-1" });
    expect(ledger.inserts()).toBe(1);
    expect(ledger.rows).toHaveLength(2);
    expect(mocks.createTransfer).toHaveBeenCalledTimes(2);
    expect(
      mocks.createTransfer.mock.calls.map(
        (call) =>
          (call[0] as { clientMutationId?: string }).clientMutationId,
      ),
    ).toEqual([MUTATION_ID, MUTATION_ID]);
  });

  it("keeps ok:true + refreshPending when refresh throws, and retry does not duplicate", async () => {
    const first = await createTransferAction(transferInput());
    expect(first).toMatchObject({
      ok: true,
      refreshPending: true,
      refreshPendingMessage: "Sparat. Uppdaterar siffrorna…",
    });
    const retry = await createTransferAction(transferInput());
    expect(retry).toMatchObject({
      ok: true,
      id: "transfer-out-1",
      refreshPending: true,
    });
    expect(ledger.inserts()).toBe(1);
  });

  it("collapses concurrent submissions of the same mutation id to one transfer", async () => {
    const [a, b] = await Promise.all([
      createTransferAction(transferInput()),
      createTransferAction(transferInput()),
    ]);
    expect(a).toMatchObject({ ok: true, id: "transfer-out-1" });
    expect(b).toMatchObject({ ok: true, id: "transfer-out-1" });
    expect(ledger.inserts()).toBe(1);
    expect(ledger.rows).toHaveLength(2);
  });
});

describe("cash withdrawal idempotency", () => {
  let ledger: ReturnType<typeof makePairedLedger>;

  beforeEach(() => {
    vi.resetAllMocks();
    ledger = makePairedLedger();
    mocks.createTransfer.mockImplementation(ledger.createTransfer);
    mocks.createCash.mockImplementation(ledger.createCash);
    mocks.refresh.mockRejectedValue(new Error("snapshot offline"));
  });

  it("creates one bank debit and one cash credit in one group", async () => {
    const result = await createCashWithdrawalAction(cashInput());
    expect(result).toMatchObject({
      ok: true,
      id: "cash_withdrawal-out-1",
      refreshPending: true,
    });
    expect(ledger.rows).toHaveLength(2);
    expect(ledger.rows.every((row) => row.transactionType === "cash_withdrawal")).toBe(
      true,
    );
    expect(new Set(ledger.rows.map((row) => row.transferGroupId)).size).toBe(1);
    expect(ledger.inserts()).toBe(1);
  });

  it("retries the same mutation id without a second withdrawal", async () => {
    const first = await createCashWithdrawalAction(cashInput());
    const second = await createCashWithdrawalAction(cashInput());
    expect(first.ok && second.ok && first.id === second.id).toBe(true);
    expect(ledger.inserts()).toBe(1);
    expect(ledger.rows).toHaveLength(2);
  });

  it("keeps ok:true + refreshPending after a lost refresh, then replay stays unique", async () => {
    const first = await createCashWithdrawalAction(cashInput());
    const retry = await createCashWithdrawalAction(cashInput());
    expect(first).toMatchObject({ ok: true, refreshPending: true });
    expect(retry).toMatchObject({
      ok: true,
      id: "cash_withdrawal-out-1",
      refreshPending: true,
    });
    expect(ledger.inserts()).toBe(1);
  });

  it("collapses concurrent same-id withdrawals to one operation", async () => {
    const [a, b] = await Promise.all([
      createCashWithdrawalAction(cashInput()),
      createCashWithdrawalAction(cashInput()),
    ]);
    expect(a).toMatchObject({ ok: true, id: "cash_withdrawal-out-1" });
    expect(b).toMatchObject({ ok: true, id: "cash_withdrawal-out-1" });
    expect(ledger.inserts()).toBe(1);
  });
});
