import { describe, expect, it } from "vitest";
import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  PlanItem,
  Profile,
} from "@/domain/finance";
import {
  fetchMenuSnapshotBundle,
  MENU_SNAPSHOT_ACCOUNT_TABLES,
  MENU_SNAPSHOT_CORE_TABLES,
  MENU_SNAPSHOT_UNUSED_TABLES,
  type MenuSnapshotSources,
} from "./menu-snapshot-fetch";

const NOW = new Date("2026-08-28T10:00:00.000Z");

const profile: Profile = {
  id: "user-1",
  displayName: "Christian",
  timezone: "Asia/Bangkok",
  primaryCurrency: "THB",
  referenceCurrency: "SEK",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
  onboardingSaldoAt: null,
  onboardingCompletedAt: null,
  gettingStartedCompletedAt: null,
  gettingStartedCollapsed: false,
};

const account: Account = {
  id: "acc-1",
  userId: "user-1",
  name: "Bangkok Bank",
  institution: "Bangkok Bank",
  accountType: "checking",
  kind: "thai_bank",
  currency: "THB",
  maskedIdentifier: null,
  isActive: true,
  isDefault: true,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("menu snapshot query contract", () => {
  it("names the unused gamification tables so loaders stay off them", () => {
    expect(MENU_SNAPSHOT_CORE_TABLES).toEqual([
      "profiles",
      "accounts",
      "plan_items",
    ]);
    expect(MENU_SNAPSHOT_ACCOUNT_TABLES).toEqual([
      "balance_checkpoints",
      "transactions",
    ]);
    expect(MENU_SNAPSHOT_UNUSED_TABLES).toEqual([
      "user_progress",
      "progress_events",
    ]);
  });

  it("for a nearly-empty invited account runs 3 parallel reads and skips ledger work", async () => {
    const events: string[] = [];
    const profileGate = deferred();
    const accountsGate = deferred();
    const planGate = deferred();
    let checkpointCalls = 0;
    let txCalls = 0;

    const sources: MenuSnapshotSources = {
      loadProfile: async () => {
        events.push("profile:start");
        await profileGate.promise;
        events.push("profile:end");
        return profile;
      },
      loadAccounts: async () => {
        events.push("accounts:start");
        await accountsGate.promise;
        events.push("accounts:end");
        return [];
      },
      loadPlanItems: async () => {
        events.push("plan:start");
        await planGate.promise;
        events.push("plan:end");
        return [] as PlanItem[];
      },
      loadCheckpoint: async () => {
        checkpointCalls += 1;
        return null;
      },
      loadTransactions: async () => {
        txCalls += 1;
        return [] as CanonicalTransaction[];
      },
    };

    const pending = fetchMenuSnapshotBundle(sources, NOW);
    await flush();

    expect(events).toEqual([
      "profile:start",
      "accounts:start",
      "plan:start",
    ]);
    expect(checkpointCalls).toBe(0);
    expect(txCalls).toBe(0);

    profileGate.resolve();
    accountsGate.resolve();
    planGate.resolve();
    const bundle = await pending;

    expect(bundle.primary).toBeNull();
    expect(bundle.checkpoint).toBeNull();
    expect(bundle.transactions).toEqual([]);
    expect(checkpointCalls).toBe(0);
    expect(txCalls).toBe(0);
  });

  it("with a primary account fetches checkpoint and ledger in parallel, not after unused work", async () => {
    const events: string[] = [];
    const profileGate = deferred();
    const accountsGate = deferred();
    const planGate = deferred();
    const checkpointGate = deferred();
    const txSince: string[] = [];

    const sources: MenuSnapshotSources = {
      loadProfile: async () => {
        events.push("profile:start");
        await profileGate.promise;
        events.push("profile:end");
        return profile;
      },
      loadAccounts: async () => {
        events.push("accounts:start");
        await accountsGate.promise;
        events.push("accounts:end");
        return [account];
      },
      loadPlanItems: async () => {
        events.push("plan:start");
        await planGate.promise;
        events.push("plan:end");
        return [] as PlanItem[];
      },
      loadCheckpoint: async () => {
        events.push("checkpoint:start");
        await checkpointGate.promise;
        events.push("checkpoint:end");
        return null;
      },
      loadTransactions: async (options) => {
        events.push("tx:start");
        txSince.push(options.sinceIso);
        return [] as CanonicalTransaction[];
      },
    };

    const pending = fetchMenuSnapshotBundle(sources, NOW);
    await flush();
    expect(events).toEqual([
      "profile:start",
      "accounts:start",
      "plan:start",
    ]);

    accountsGate.resolve();
    await flush();
    expect(events).toContain("checkpoint:start");
    expect(events).not.toContain("profile:end");
    expect(events).not.toContain("tx:start");

    profileGate.resolve();
    planGate.resolve();
    await flush();
    expect(events).toContain("tx:start");
    expect(events).not.toContain("checkpoint:end");
    expect(txSince).toHaveLength(1);

    checkpointGate.resolve();
    const bundle = await pending;
    expect(bundle.primary?.id).toBe("acc-1");
  });

  it("only refetches the ledger when an older checkpoint sits outside the spend window", async () => {
    const oldCheckpoint: BalanceCheckpoint = {
      id: "cp-old",
      userId: "user-1",
      accountId: "acc-1",
      balanceMinor: 100_00,
      currency: "THB",
      thbMinor: 100_00,
      fxRate: 1,
      fxAsOf: "2026-01-01T00:00:00.000Z",
      fxSource: "identity",
      verifiedAt: "2026-01-01T00:00:00.000Z",
      source: "manual",
      sourceObservationId: null,
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const txSince: string[] = [];

    const sources: MenuSnapshotSources = {
      loadProfile: async () => profile,
      loadAccounts: async () => [account],
      loadPlanItems: async () => [] as PlanItem[],
      loadCheckpoint: async () => oldCheckpoint,
      loadTransactions: async (options) => {
        txSince.push(options.sinceIso);
        return [] as CanonicalTransaction[];
      },
    };

    await fetchMenuSnapshotBundle(sources, NOW);

    expect(txSince).toHaveLength(2);
    expect(Date.parse(txSince[1]!)).toBeLessThan(Date.parse(txSince[0]!));
  });
});
