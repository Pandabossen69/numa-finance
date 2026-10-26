/** @vitest-environment jsdom */

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDetail } from "@/features/finance/load-account-detail";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  clearClientSessionCaches,
  lastAccountsSnapshot,
  lastHomeSnapshot,
  rememberAccountsSnapshot,
  rememberHomeSnapshot,
} from "@/features/home/last-snapshot";
import { resetAccountEditStateForTests } from "@/features/finance/account-edit-store";

vi.mock("@/components/layout/NavIntent", () => ({
  useNavIntent: () => ({
    pathname: "/konton",
    markIntent: () => {},
    clearIntent: () => {},
    navigateSpaTab: () => {},
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    refresh: () => {},
    replace: () => {},
    back: () => {},
    prefetch: () => {},
  }),
}));

vi.mock("@/features/finance/actions", () => ({
  createCheckpointAction: vi.fn(),
  updateAccountAction: vi.fn(),
  removeAccountAction: vi.fn(),
  restoreAccountAction: vi.fn(),
}));

import { createCheckpointAction } from "@/features/finance/actions";
import { AccountDetailActions } from "@/components/accounts/AccountDetailActions";
import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";

const createCheckpoint = vi.mocked(createCheckpointAction);

const accountId = "f269fb50-e542-4679-a478-fcf17c794b23";
const otherId = "a1b2c3d4-e542-4679-a478-fcf17c794b23";

const account: AccountDetail = {
  id: accountId,
  name: "Bangkok Bank",
  kind: "thai_bank",
  kindLabelSv: "Thai-bank",
  currency: "THB",
  isDefault: true,
  isActive: true,
  calculatedMinor: 100_000,
  hasLedgerHistory: false,
  activeCount: 2,
  movements: [],
};

const accounts: AccountsSnapshot = {
  accounts: [
    {
      id: accountId,
      name: "Bangkok Bank",
      institution: null,
      maskedIdentifier: null,
      kind: "thai_bank",
      kindLabelSv: "Thai-bank",
      currency: "THB",
      isDefault: true,
      isActive: true,
      calculatedMinor: 100_000,
      thbMinor: 100_000,
      fxRate: 1,
      fxSource: "identity",
    },
    {
      id: otherId,
      name: "Kontant",
      institution: null,
      maskedIdentifier: null,
      kind: "cash",
      kindLabelSv: "Kontant",
      currency: "THB",
      isDefault: false,
      isActive: true,
      calculatedMinor: 50_000,
      thbMinor: 50_000,
      fxRate: 1,
      fxSource: "identity",
    },
  ],
  archivedAccounts: [],
  totalThbMinor: 150_000,
};

function homeWithSaldo(calculatedBalanceMinor: number): HomeSnapshot {
  return {
    userId: "user-local",
    displayName: "Hugo",
    timeZone: "Asia/Bangkok",
    primaryAccountId: accountId,
    currency: "THB",
    monthKey: "2026-10",
    monthLabelSv: "oktober",
    hasBankTruth: true,
    calculatedBalanceMinor,
    verificationLabel: null,
    todaySpendingMinor: 0,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: 0,
    cycleSpendingMinor: 0,
    safeToSpendTodayMinor: 0,
    cycleStartLabelSv: null,
    cycleEndLabelSv: null,
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: true,
    planIncomeMinor: 0,
    planExpenseMinor: 0,
    planSavingsMinor: 0,
    freeToSpendMinor: 0,
    remainingFreeMinor: 0,
    spendDaysLeft: 10,
    dayBudgetMinor: 0,
    remainingTodayMinor: 0,
    livingPoolMinor: calculatedBalanceMinor,
    reservedUntilIncomeMinor: 0,
    daysUntilIncome: 10,
    nextIncomeLabelSv: null,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 0,
    wealthTotalMinor: calculatedBalanceMinor,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: 0,
    overMinor: calculatedBalanceMinor,
    financeRevision: "rev",
    verifiedAt: "2026-10-26T00:00:00.000Z",
    truthStatus: "verified",
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  );
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function moneyLabel(root: ParentNode, selector: string): string {
  return (
    root.querySelector(selector)?.getAttribute("aria-label")?.replace(/\u202F/g, " ") ??
    ""
  );
}

describe("account detail saved balance", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    clearClientSessionCaches();
    resetAccountEditStateForTests();
    createCheckpoint.mockReset();
    rememberAccountsSnapshot(accounts);
    rememberHomeSnapshot(homeWithSaldo(150_000));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    document.body.querySelector("[role='status']")?.remove();
    clearClientSessionCaches();
    resetAccountEditStateForTests();
  });

  it("shows the new balance on the detail and the list as soon as saldo is saved", async () => {
    createCheckpoint.mockResolvedValue({ ok: true, thbMinor: 150_000 });

    await act(async () => {
      root.render(
        createElement(
          "div",
          null,
          createElement(AccountDetailActions, { account }),
          createElement(AccountsDashboard, { data: accounts }),
        ),
      );
    });

    expect(moneyLabel(host, "[data-account-balance] [aria-label]")).toBe(
      "1 000,00 THB",
    );
    expect(moneyLabel(host, "a[aria-label='Bangkok Bank, öppna konto'] [aria-label]")).toBe(
      "1 000 THB",
    );

    await act(async () => {
      const open = [...host.querySelectorAll("button")].find(
        (button) => button.textContent === "Uppdatera saldo",
      );
      open?.click();
    });

    const input = host.querySelector("input") as HTMLInputElement;
    await act(async () => {
      setInputValue(input, "1500,00");
    });

    await act(async () => {
      host.querySelector("form")?.requestSubmit();
      await createCheckpoint.mock.results[0]?.value;
    });

    expect(host.querySelector("form")).toBeNull();
    expect(document.body.querySelector("[role='status']")?.textContent).toBe("Sparat");
    expect(moneyLabel(host, "[data-account-balance] [aria-label]")).toBe(
      "1 500,00 THB",
    );
    expect(moneyLabel(host, "a[aria-label='Bangkok Bank, öppna konto'] [aria-label]")).toBe(
      "1 500 THB",
    );
    expect(lastAccountsSnapshot()?.accounts.find((row) => row.id === accountId)?.calculatedMinor).toBe(
      150_000,
    );
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(200_000);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(200_000);
    expect(createCheckpoint).toHaveBeenCalledOnce();
  });

  it("shows only restore for an archived account", async () => {
    await act(async () => {
      root.render(
        createElement(AccountDetailActions, {
          account: { ...account, isActive: false, name: "Gammalt" },
        }),
      );
    });

    expect(host.textContent).not.toContain("Uppdatera saldo");
    expect(host.textContent).toContain("Återställ konto");
  });
});
