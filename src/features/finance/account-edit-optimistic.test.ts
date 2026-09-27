import { describe, expect, it } from "vitest";
import type { AccountBalanceRow, AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  adoptServerAccounts,
  beginAccountBalanceEdit,
  beginAccountDetailsEdit,
  commitAccountEditSession,
  createAccountEditSession,
  refineAccountBalanceThb,
  rollbackAccountEditSession,
} from "./account-edit-optimistic";

function row(
  partial: Partial<AccountBalanceRow> & { id: string },
): AccountBalanceRow {
  const currency = partial.currency ?? "THB";
  const calculatedMinor =
    partial.calculatedMinor === undefined ? 10_000 : partial.calculatedMinor;
  return {
    id: partial.id,
    name: partial.name ?? "Bangkok Bank",
    institution: partial.institution ?? null,
    maskedIdentifier: partial.maskedIdentifier ?? null,
    kind: partial.kind ?? "thai_bank",
    kindLabelSv: partial.kindLabelSv ?? "Thai-bank",
    currency,
    isDefault: partial.isDefault ?? false,
    isActive: partial.isActive ?? true,
    calculatedMinor,
    thbMinor:
      partial.thbMinor === undefined
        ? currency === "THB"
          ? calculatedMinor
          : null
        : partial.thbMinor,
    fxRate: partial.fxRate === undefined ? (currency === "THB" ? 1 : null) : partial.fxRate,
    fxSource: partial.fxSource ?? (currency === "THB" ? "identity" : null),
  };
}

function snapshot(accounts: AccountBalanceRow[]): AccountsSnapshot {
  const total = accounts.reduce(
    (sum, account) => sum + (account.thbMinor ?? 0),
    0,
  );
  return {
    accounts,
    archivedAccounts: [],
    totalThbMinor: total,
  };
}

function details(
  session: ReturnType<typeof createAccountEditSession>,
  accountId: string,
  name: string,
) {
  const current = session.snapshot.accounts.find((account) => account.id === accountId);
  const started = beginAccountDetailsEdit(session, {
    accountId,
    name,
    kind: current?.kind ?? "thai_bank",
    kindLabelSv: current?.kindLabelSv ?? "Thai-bank",
    currency: current?.currency ?? "THB",
    makeDefault: false,
  });
  if (!started) throw new Error("missing account");
  return started;
}

describe("optimistic account edit", () => {
  it("updates the list name and the saldo total before the server answers", () => {
    const initial = createAccountEditSession(
      snapshot([
        row({ id: "a", name: "Lönekonto", calculatedMinor: 10_000, isDefault: true }),
        row({ id: "b", name: "Kontant", calculatedMinor: 2_500, kind: "cash", kindLabelSv: "Kontant" }),
      ]),
    );

    const named = details(initial, "a", "Sparkonto");
    expect(named.session.snapshot.accounts[0]?.name).toBe("Sparkonto");
    expect(named.session.snapshot.accounts[1]?.name).toBe("Kontant");
    expect(named.session.snapshot.totalThbMinor).toBe(12_500);

    const balanced = beginAccountBalanceEdit(named.session, {
      accountId: "a",
      calculatedMinor: 8_000,
    });
    expect(balanced).not.toBeNull();
    expect(balanced?.session.snapshot.accounts[0]).toMatchObject({
      name: "Sparkonto",
      calculatedMinor: 8_000,
      thbMinor: 8_000,
    });
    expect(balanced?.session.snapshot.accounts[1]?.calculatedMinor).toBe(2_500);
    expect(balanced?.session.snapshot.totalThbMinor).toBe(10_500);

    const committed = commitAccountEditSession(
      balanced!.session,
      "a",
      balanced!.generation,
    );
    expect(committed.committed).toBe(true);
    expect(committed.session.snapshot.accounts[0]?.name).toBe("Sparkonto");
    expect(committed.session.snapshot.totalThbMinor).toBe(10_500);
  });

  it("rolls a failed save back to the exact previous name, saldo and total", () => {
    const initial = createAccountEditSession(
      snapshot([
        row({ id: "a", name: "Lönekonto", calculatedMinor: 10_000, isDefault: true }),
        row({ id: "b", name: "Kontant", calculatedMinor: 2_500 }),
      ]),
    );
    const named = details(initial, "a", "Fel namn");
    const failedName = rollbackAccountEditSession(
      named.session,
      "a",
      named.generation,
    );
    expect(failedName.rolledBack).toBe(true);
    expect(failedName.session.snapshot.accounts[0]?.name).toBe("Lönekonto");
    expect(failedName.session.snapshot.totalThbMinor).toBe(12_500);

    const balanced = beginAccountBalanceEdit(failedName.session, {
      accountId: "b",
      calculatedMinor: 9_999,
    });
    const failedBalance = rollbackAccountEditSession(
      balanced!.session,
      "b",
      balanced!.generation,
    );
    expect(failedBalance.rolledBack).toBe(true);
    expect(failedBalance.session.snapshot.accounts[0]).toMatchObject({
      name: "Lönekonto",
      calculatedMinor: 10_000,
    });
    expect(failedBalance.session.snapshot.accounts[1]).toMatchObject({
      name: "Kontant",
      calculatedMinor: 2_500,
      thbMinor: 2_500,
    });
    expect(failedBalance.session.snapshot.totalThbMinor).toBe(12_500);
  });

  it("ignores a stale failure and a stale success after a newer local edit", () => {
    const initial = createAccountEditSession(
      snapshot([row({ id: "a", name: "Ett", calculatedMinor: 1_000 })]),
    );
    const first = details(initial, "a", "Två");
    const second = details(first.session, "a", "Tre");
    const staleFailure = rollbackAccountEditSession(
      second.session,
      "a",
      first.generation,
    );
    expect(staleFailure.rolledBack).toBe(false);
    expect(staleFailure.session.snapshot.accounts[0]?.name).toBe("Tre");

    const staleSuccess = commitAccountEditSession(
      second.session,
      "a",
      first.generation,
    );
    expect(staleSuccess.committed).toBe(false);
    expect(staleSuccess.session.snapshot.accounts[0]?.name).toBe("Tre");
    expect(staleSuccess.session.inflight.has("a")).toBe(true);

    const firstBalance = beginAccountBalanceEdit(initial, {
      accountId: "a",
      calculatedMinor: 2_000,
    });
    const secondBalance = beginAccountBalanceEdit(firstBalance!.session, {
      accountId: "a",
      calculatedMinor: 4_000,
    });
    const staleThb = refineAccountBalanceThb(
      secondBalance!.session,
      "a",
      firstBalance!.generation,
      2_000,
    );
    expect(staleThb.applied).toBe(false);
    expect(staleThb.session.snapshot.totalThbMinor).toBe(4_000);
    const staleBalanceFailure = rollbackAccountEditSession(
      secondBalance!.session,
      "a",
      firstBalance!.generation,
    );
    expect(staleBalanceFailure.rolledBack).toBe(false);
    expect(staleBalanceFailure.session.snapshot.accounts[0]?.calculatedMinor).toBe(
      4_000,
    );
    expect(staleBalanceFailure.session.snapshot.totalThbMinor).toBe(4_000);
  });

  it("keeps the newer local row when a refetch still has the previous values", () => {
    const initial = createAccountEditSession(
      snapshot([
        row({ id: "a", name: "Ett", calculatedMinor: 1_000, isDefault: true }),
        row({ id: "b", name: "Två", calculatedMinor: 500 }),
      ]),
    );
    const edited = beginAccountBalanceEdit(details(initial, "a", "Nytt").session, {
      accountId: "a",
      calculatedMinor: 3_000,
    });
    const during = adoptServerAccounts(edited!.session, initial.snapshot);
    expect(during.changed).toBe(true);
    expect(during.session.snapshot.accounts[0]).toMatchObject({
      name: "Nytt",
      calculatedMinor: 3_000,
    });
    expect(during.session.snapshot.totalThbMinor).toBe(3_500);

    const committed = commitAccountEditSession(
      edited!.session,
      "a",
      edited!.generation,
    );
    const staleRefetch = adoptServerAccounts(
      committed.session,
      initial.snapshot,
    );
    expect(staleRefetch.session.snapshot.accounts[0]).toMatchObject({
      name: "Nytt",
      calculatedMinor: 3_000,
      thbMinor: 3_000,
    });
    expect(staleRefetch.session.snapshot.totalThbMinor).toBe(3_500);

    const newerServer = snapshot([
      row({ id: "a", name: "Från servern", calculatedMinor: 7_000, isDefault: true }),
      row({ id: "b", name: "Två", calculatedMinor: 500 }),
    ]);
    const fresh = adoptServerAccounts(staleRefetch.session, newerServer);
    expect(fresh.session.snapshot.accounts[0]).toMatchObject({
      name: "Från servern",
      calculatedMinor: 7_000,
    });
    expect(fresh.session.snapshot.totalThbMinor).toBe(7_500);
  });
});
