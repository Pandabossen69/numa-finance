import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyStore, type NumaStoreData } from "@/lib/store/types";
import type { CanonicalTransaction } from "@/domain/finance";
import { ingestBankMail, type BankMailStore } from "@/features/imports/bank-mail-ingest";
import type { BankMailPendingInsert } from "@/features/imports/bank-mail-ingest";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REF_FINGERPRINT = "bbl-mail:ref:200002";

const cardBody = readFileSync(
  new URL("../../../scripts/fixtures/bangkok-card-payment.txt", import.meta.url),
  "utf8",
);

const storeState = vi.hoisted(() => ({
  data: null as unknown as NumaStoreData,
}));

vi.mock("@/lib/store/local-store", () => ({
  readStore: async () => structuredClone(storeState.data),
  updateStore: async (mutator: (data: NumaStoreData) => void) => {
    const next = structuredClone(storeState.data);
    mutator(next);
    storeState.data = next;
    return next;
  },
}));

type Row = Record<string, unknown>;

const remote = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
}));

function query(rows: Row[]) {
  const filters: Array<(row: Row) => boolean> = [];
  const api = {
    select() {
      return api;
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return api;
    },
    in(column: string, values: unknown[]) {
      filters.push((row) => values.includes(row[column]));
      return api;
    },
    neq(column: string, value: unknown) {
      filters.push((row) => row[column] !== value);
      return api;
    },
    limit() {
      return api;
    },
    maybeSingle: async () => {
      const hit = rows.find((row) => filters.every((filter) => filter(row))) ?? null;
      return { data: hit, error: null };
    },
    then(resolve: (value: { data: Row[]; error: null }) => void) {
      const data = rows.filter((row) => filters.every((filter) => filter(row)));
      resolve({ data, error: null });
    },
  };
  return api;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from(table: string) {
      return query(remote.tables[table] ?? []);
    },
  }),
}));

vi.mock("@/lib/supabase/auth-user", () => ({
  getAuthUser: async () => ({
    id: USER,
    email: "local@example.com",
    metadataDisplayName: null,
  }),
}));

const { findByDedupeKey: findLocal } = await import("@/lib/store/local-repository");
const { findByDedupeKey: findRemote } = await import("@/lib/store/supabase-repository");
const { createBankMailStore } = await import("@/features/imports/bank-mail-store");

function ledger(status: "confirmed" | "voided"): CanonicalTransaction {
  return {
    id: "tx-booked",
    userId: USER,
    accountId: ACCOUNT,
    counterAccountId: null,
    direction: "debit",
    transactionType: "expense",
    amountMinor: 31250,
    currency: "THB",
    occurredAt: "2026-01-03T04:08:05.000Z",
    description: "MCD-00179HUA-HIN MARKET V",
    merchant: "MCD-00179HUA-HIN MARKET V",
    category: null,
    source: "bank_import",
    status,
    balanceAfterMinor: null,
    fingerprint: REF_FINGERPRINT,
    sourceObservationId: null,
    transferGroupId: null,
    syncStatus: "synced",
    createdAt: "2026-01-03T04:08:05.000Z",
    updatedAt: "2026-01-03T04:08:05.000Z",
  };
}

function remoteRow(status: "confirmed" | "voided"): Row {
  return {
    id: "tx-booked",
    user_id: USER,
    fingerprint: REF_FINGERPRINT,
    status,
    source_observation_id: null,
  };
}

type MemoryRow = BankMailPendingInsert & { observationId: string; candidateId: string };

function cardStore(
  findByDedupeKey: BankMailStore["findByDedupeKey"],
): BankMailStore & { rows: MemoryRow[] } {
  const rows: MemoryRow[] = [];
  return {
    rows,
    async findAccount(userId, accountId) {
      if (userId === USER && accountId === ACCOUNT) {
        return { ok: true, account: { id: ACCOUNT, name: "Bangkok Bank" } };
      }
      return { ok: false, reason: "missing" };
    },
    findByDedupeKey,
    async insertPending(row) {
      const observationId = `obs-${rows.length + 1}`;
      const candidateId = `cand-${rows.length + 1}`;
      rows.push({ ...row, observationId, candidateId });
      return { ok: true, observationId, candidateId };
    },
  };
}

function serviceStore() {
  return createBankMailStore({
    from(table: string) {
      return query(remote.tables[table] ?? []);
    },
  } as never);
}

beforeEach(() => {
  storeState.data = createEmptyStore();
  remote.tables = {};
});

describe.each([
  ["local-repository", () => findLocal],
  ["supabase-repository", () => findRemote],
  ["bank-mail-store", () => serviceStore().findByDedupeKey],
] as const)("%s booked fingerprint", (_name, lookup) => {
  async function ingest(status: "confirmed" | "voided" | "absent") {
    if (status !== "absent") {
      storeState.data.transactions = [ledger(status)];
      remote.tables.transactions = [remoteRow(status)];
    }
    const store = cardStore(lookup());
    const result = await ingestBankMail(
      {
        userId: USER,
        accountId: ACCOUNT,
        subject: "Payment confirmation",
        from: "Bangkok Bank <notify@bank.example>",
        date: "Sat, 3 Jan 2026 11:08:05 +0700",
        body: cardBody,
        messageId: `booked-${status}@bank.example`,
      },
      store,
    );
    return { result, cards: store.rows.length };
  }

  it("redan bokad ref ger inget kort", async () => {
    const { result, cards } = await ingest("confirmed");
    expect(result).toMatchObject({ result: "duplicate" });
    expect(cards).toBe(0);
  });

  it("voidad ref ger kort", async () => {
    const { result, cards } = await ingest("voided");
    expect(result.result).toBe("created");
    expect(cards).toBe(1);
  });

  it("ny ref ger kort", async () => {
    const { result, cards } = await ingest("absent");
    expect(result.result).toBe("created");
    expect(cards).toBe(1);
  });
});
