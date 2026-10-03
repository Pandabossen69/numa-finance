import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OBS = "11111111-1111-4111-8111-111111111111";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  opening: null as string | null,
  occurredAt: "2026-01-03T04:08:05.000Z",
  inserts: [] as Row[],
  updates: [] as Array<{ table: string; patch: Row }>,
  ack: null as Promise<unknown> | null,
}));

vi.mock("next/server", () => ({
  after(task: () => unknown) {
    state.ack = Promise.resolve().then(task);
  },
}));

vi.mock("@/lib/store/repository", () => ({
  openingBalanceVerifiedAt: async () => state.opening,
}));

function rowsFor(table: string): Row[] {
  if (table === "source_observations") {
    return [
      {
        id: OBS,
        user_id: USER,
        kind: "bank_mail",
        status: "needs_review",
      },
    ];
  }
  if (table === "extracted_transaction_candidates") {
    return [
      {
        id: "cand-1",
        user_id: USER,
        observation_id: OBS,
        status: "needs_review",
        raw_payload: { accountId: ACCOUNT, counterparty: "MCD" },
        amount_minor: 10000,
        direction: "debit",
        description: "MCD",
        occurred_at: state.occurredAt,
        fingerprint: "bbl-mail:ref:900001",
        canonical_transaction_id: null,
      },
    ];
  }
  if (table === "accounts") {
    return [
      {
        id: ACCOUNT,
        user_id: USER,
        currency: "THB",
        is_active: true,
      },
    ];
  }
  return [];
}

function query(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let patch: Row | null = null;
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
    order() {
      return api;
    },
    limit() {
      return api;
    },
    maybeSingle: async () => {
      const hit =
        rowsFor(table).find((row) => filters.every((filter) => filter(row))) ?? null;
      return { data: hit, error: null };
    },
    insert(row: Row) {
      const stored = {
        id: "tx-new",
        counter_account_id: null,
        balance_after_minor: null,
        transfer_group_id: null,
        plan_item_id: null,
        linked_plan_item_id: null,
        created_at: "2026-10-03T03:00:00.000Z",
        updated_at: "2026-10-03T03:00:00.000Z",
        ...row,
      };
      if (table === "transactions") state.inserts.push(stored);
      return {
        select() {
          return {
            single: async () => ({ data: stored, error: null }),
          };
        },
      };
    },
    update(next: Row) {
      patch = next;
      return api;
    },
    then(resolve: (value: { data: null; error: null }) => void) {
      if (patch) state.updates.push({ table, patch });
      resolve({ data: null, error: null });
    },
  };
  return api;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "test-token" } },
      }),
      getUser: async () => ({ data: { user: { id: USER } }, error: null }),
    },
    from(table: string) {
      return query(table);
    },
  }),
}));

const { confirmBankMailCandidate, rejectBankMailCandidate } = await import(
  "@/features/imports/bank-mail-confirm"
);

beforeEach(() => {
  state.opening = null;
  state.occurredAt = "2026-01-03T04:08:05.000Z";
  state.inserts = [];
  state.updates = [];
  state.ack = null;
});

afterEach(async () => {
  await state.ack;
});

describe("confirmBankMailCandidate date gate", () => {
  it("bokar inget när mejlet ligger före Rörelser-golvet", async () => {
    await expect(
      confirmBankMailCandidate({ observationId: OBS }),
    ).rejects.toThrow(/för gammalt för att bekräftas/);
    await expect(
      confirmBankMailCandidate({ observationId: OBS }),
    ).rejects.toThrow(/syns inte i Rörelser/);
    expect(state.inserts).toHaveLength(0);
  });

  it("bokar inget när mejlet ligger före ingående saldo", async () => {
    state.occurredAt = "2026-10-03T04:00:00.000Z";
    state.opening = "2026-10-04T00:00:00.000Z";
    await expect(
      confirmBankMailCandidate({ observationId: OBS }),
    ).rejects.toThrow(/påverkar inte saldot/);
    expect(state.inserts).toHaveLength(0);
  });

  it("bokar när datumet ligger i fönstret", async () => {
    state.occurredAt = "2026-10-03T04:00:00.000Z";
    state.opening = null;
    const tx = await confirmBankMailCandidate({ observationId: OBS });
    expect(tx.id).toBe("tx-new");
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]?.status).toBe("confirmed");
  });

  it("bokar med kontot från kortet i samma läsvåg", async () => {
    state.occurredAt = "2026-10-03T04:00:00.000Z";
    state.opening = "2026-09-01T00:00:00.000Z";
    const tx = await confirmBankMailCandidate({
      observationId: OBS,
      accountId: ACCOUNT,
    });
    expect(tx.id).toBe("tx-new");
    expect(state.inserts).toHaveLength(1);
    expect(state.updates).toHaveLength(0);
    await state.ack;
    expect(state.updates.map((row) => row.table).sort()).toEqual([
      "extracted_transaction_candidates",
      "source_observations",
    ]);
    expect(state.updates.find((row) => row.table === "source_observations")?.patch.notes).toBe(
      "Bekräftad och sparad",
    );
  });
});

describe("confirm ack path", () => {
  it("kör gammalt mejl, ägarskap och dubblett före insert, och kön efter svaret", () => {
    const src = readFileSync(new URL("./bank-mail-confirm.ts", import.meta.url), "utf8");
    const gate = src.indexOf("bankMailConfirmBlockedMessage({");
    const insert = src.indexOf(".insert(");
    const later = src.indexOf("after(async () => {");
    expect(src).toContain("getUser(accessToken)");
    expect(src).toContain("obs.user_id !== user.id");
    expect(src).toContain('neq("status", "voided")');
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(insert);
    expect(insert).toBeLessThan(later);
  });
});

describe("rejectBankMailCandidate", () => {
  it("markerar kandidaten avvisad och observationen processed utan transaktion", async () => {
    await rejectBankMailCandidate({ observationId: OBS });
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toEqual([
      {
        table: "extracted_transaction_candidates",
        patch: expect.objectContaining({ status: "rejected" }),
      },
      {
        table: "source_observations",
        patch: expect.objectContaining({
          status: "processed",
          notes: "Avvisad",
        }),
      },
    ]);
  });
});
