import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANK_MAIL_IGNORED_LOG, BANK_MAIL_SOURCE_LABEL } from "@/features/imports/bank-mail-label";
import {
  bankMailTokenMatches,
  bankMailUserAllowed,
  handleBankMailPost,
  ingestBankMail,
  type BankMailPendingInsert,
  type BankMailStore,
} from "@/features/imports/bank-mail-ingest";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACCOUNT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TOKEN = "test-token-value";

const cardBody = readFileSync(
  new URL("../../../scripts/fixtures/bangkok-card-payment.txt", import.meta.url),
  "utf8",
);
const topupBody = readFileSync(
  new URL("../../../scripts/fixtures/bangkok-promptpay-topup.txt", import.meta.url),
  "utf8",
);
const marketingBody = readFileSync(
  new URL("../../../scripts/fixtures/marketing.txt", import.meta.url),
  "utf8",
);

type MemoryRow = BankMailPendingInsert & {
  observationId: string;
  candidateId: string;
  status: "needs_review";
  kind: "bank_mail";
};

function memoryStore(): BankMailStore & { rows: MemoryRow[] } {
  const rows: MemoryRow[] = [];
  return {
    rows,
    async findAccount(userId, accountId) {
      if (userId === USER && accountId === ACCOUNT) {
        return { ok: true, account: { id: ACCOUNT, name: "Bangkok Bank" } };
      }
      if (accountId === "dddddddd-dddd-4ddd-8ddd-dddddddddddd") {
        return { ok: false, reason: "currency" };
      }
      return { ok: false, reason: "missing" };
    },
    async findByDedupeKey(userId, keys) {
      const hit = rows.find(
        (row) =>
          row.userId === userId &&
          ((keys.messageId != null && row.messageId === keys.messageId) ||
            (keys.bankReference != null && row.bankReference === keys.bankReference) ||
            row.fingerprint === keys.fingerprint),
      );
      return hit ? { observationId: hit.observationId } : null;
    },
    async insertPending(row) {
      const clash = rows.find(
        (existing) =>
          existing.userId === row.userId &&
          ((row.messageId != null && existing.messageId === row.messageId) ||
            (row.bankReference != null && existing.bankReference === row.bankReference) ||
            existing.fingerprint === row.fingerprint),
      );
      if (clash) {
        return { ok: false, duplicate: true, observationId: clash.observationId };
      }
      const observationId = `obs-${rows.length + 1}`;
      const candidateId = `cand-${rows.length + 1}`;
      rows.push({
        ...row,
        observationId,
        candidateId,
        status: "needs_review",
        kind: "bank_mail",
      });
      return { ok: true, observationId, candidateId };
    },
  };
}

function fields(body: string, messageId: string) {
  return {
    userId: USER,
    accountId: ACCOUNT,
    subject: "Payment confirmation",
    from: "Bangkok Bank <notify@bank.example>",
    date: "Sat, 3 Jan 2026 11:08:05 +0700",
    body,
    messageId,
  };
}

describe("bank mail parser → confirmation candidate", () => {
  it("queues a card payment with amount, date, counterparty and account", async () => {
    const store = memoryStore();
    const result = await ingestBankMail(
      fields(cardBody, "<anon-card-200002@bank.example>"),
      store,
    );

    expect(result.result).toBe("created");
    expect(store.rows).toHaveLength(1);
    const row = store.rows[0]!;
    expect(row.kind).toBe("bank_mail");
    expect(row.status).toBe("needs_review");
    expect(row.amountMinor).toBe(31250);
    expect(row.occurredAt).toBe("2026-01-03T11:08:05+07:00");
    expect(row.counterparty).toBe("MCD-00179HUA-HIN MARKET V");
    expect(row.accountId).toBe(ACCOUNT);
    expect(row.accountName).toBe("Bangkok Bank");
    expect(row.direction).toBe("debit");
    expect(row.isWalletTopUp).toBe(false);
    expect(row.bankReference).toBe("200002");
    expect(row.messageId).toBe("anon-card-200002@bank.example");
    expect(row.currency).toBe("THB");
    if (result.result === "created") {
      expect(result.source).toBe(BANK_MAIL_SOURCE_LABEL);
      expect(result.candidateId).toBe(row.candidateId);
    }
  });

  it("queues a PromptPay-style wallet top-up without guessing a shop", async () => {
    const store = memoryStore();
    const result = await ingestBankMail(
      fields(topupBody, "anon-topup-100001@bank.example"),
      store,
    );

    expect(result.result).toBe("created");
    const row = store.rows[0]!;
    expect(row.amountMinor).toBe(35000);
    expect(row.occurredAt).toBe("2026-03-15T09:15:42+07:00");
    expect(row.counterparty).toBe("TRUE MONEY CO., LTD.");
    expect(row.accountId).toBe(ACCOUNT);
    expect(row.isWalletTopUp).toBe(true);
    expect(row.bankReference).toBe("100001");
    expect(row.direction).toBe("debit");
  });
});

describe("bank mail dedupe", () => {
  it("returns duplicate for the same Message-ID and does not add a second row", async () => {
    const store = memoryStore();
    const first = await ingestBankMail(
      fields(cardBody, "<anon-card-200002@bank.example>"),
      store,
    );
    const second = await ingestBankMail(
      fields(topupBody, "<anon-card-200002@bank.example>"),
      store,
    );

    expect(first.result).toBe("created");
    expect(second).toMatchObject({ result: "duplicate" });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.counterparty).toBe("MCD-00179HUA-HIN MARKET V");
  });

  it("returns duplicate when a new Message-ID repeats the bank reference", async () => {
    const store = memoryStore();
    await ingestBankMail(fields(cardBody, "msg-a@bank.example"), store);
    const again = await ingestBankMail(fields(cardBody, "msg-b@bank.example"), store);

    expect(again.result).toBe("duplicate");
    expect(store.rows).toHaveLength(1);
  });
});

describe("unrecognized bank mail", () => {
  it("logs once and creates nothing", async () => {
    const store = memoryStore();
    const lines: string[] = [];
    const result = await ingestBankMail(fields(marketingBody, "promo@bank.example"), store, (line) =>
      lines.push(line),
    );

    expect(result).toEqual({ result: "ignored" });
    expect(lines).toEqual([BANK_MAIL_IGNORED_LOG]);
    expect(store.rows).toHaveLength(0);
  });
});

describe("POST /api/import/bank-mail auth", () => {
  function request(body: unknown, authorization: string | null) {
    const headers = new Headers({ "content-type": "application/json" });
    if (authorization != null) headers.set("authorization", authorization);
    return new Request("http://localhost/api/import/bank-mail", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  const payload = {
    userId: USER,
    accountId: ACCOUNT,
    subject: "Payment confirmation",
    from: "notify@bank.example",
    date: "Sat, 3 Jan 2026 11:08:05 +0700",
    body: cardBody,
    messageId: "route-card@bank.example",
  };

  it("rejects a missing or wrong token with 401 and does not open a store", async () => {
    let opened = 0;
    const deps = {
      token: TOKEN,
      allowlist: USER,
      createStore: () => {
        opened += 1;
        return memoryStore();
      },
    };

    const missing = await handleBankMailPost(request(payload, null), deps);
    const wrong = await handleBankMailPost(request(payload, "Bearer nope"), deps);
    const unset = await handleBankMailPost(request(payload, `Bearer ${TOKEN}`), {
      ...deps,
      token: undefined,
    });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unset.status).toBe(401);
    expect(await wrong.json()).toEqual({ ok: false, error: "unauthorized" });
    expect(opened).toBe(0);
  });

  it("rejects a user who is not on the allowlist with 403", async () => {
    let opened = 0;
    const response = await handleBankMailPost(request({ ...payload, userId: OTHER }, `Bearer ${TOKEN}`), {
      token: TOKEN,
      allowlist: `${USER},  `,
      createStore: () => {
        opened += 1;
        return memoryStore();
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "forbidden" });
    expect(opened).toBe(0);
    expect(bankMailUserAllowed(USER, ` ${USER} `)).toBe(true);
    expect(bankMailUserAllowed(OTHER, USER)).toBe(false);
    expect(bankMailTokenMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(bankMailTokenMatches("Bearer short", "a-much-longer-secret")).toBe(false);
  });

  it("creates a candidate, then reports duplicate, and ignores marketing", async () => {
    const store = memoryStore();
    const lines: string[] = [];
    const deps = {
      token: TOKEN,
      allowlist: USER,
      createStore: () => store,
      log: (line: string) => lines.push(line),
    };

    const created = await handleBankMailPost(request(payload, `Bearer ${TOKEN}`), deps);
    const duplicate = await handleBankMailPost(request(payload, `Bearer ${TOKEN}`), deps);
    const ignored = await handleBankMailPost(
      request({ ...payload, body: marketingBody, messageId: "promo@bank.example" }, `Bearer ${TOKEN}`),
      deps,
    );

    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.result).toBe("created");
    expect(createdBody.source).toBe(BANK_MAIL_SOURCE_LABEL);
    expect(createdBody.amountMinor).toBe(31250);
    expect(JSON.stringify(createdBody)).not.toMatch(/transactionId|transactions/);

    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ ok: true, result: "duplicate" });
    expect(ignored.status).toBe(200);
    expect(await ignored.json()).toEqual({ ok: true, result: "ignored" });
    expect(lines).toEqual([BANK_MAIL_IGNORED_LOG]);
    expect(store.rows).toHaveLength(1);
  });

  it("does not queue a mail when the account is not the user's", async () => {
    const store = memoryStore();
    const response = await handleBankMailPost(
      request(
        { ...payload, accountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
        `Bearer ${TOKEN}`,
      ),
      {
        token: TOKEN,
        allowlist: USER,
        createStore: () => store,
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "account" });
    expect(store.rows).toHaveLength(0);
  });
});
