/** @vitest-environment jsdom */

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDetail } from "@/features/finance/load-account-detail";
import {
  clearClientSessionCaches,
  rememberAccountsSnapshot,
} from "@/features/home/last-snapshot";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh: () => {},
    replace: () => {},
    back: () => {},
    prefetch: () => {},
  }),
}));

vi.mock("@/features/finance/actions", () => ({
  updateAccountAction: vi.fn(),
  removeAccountAction: vi.fn(),
  restoreAccountAction: vi.fn(),
}));

import { updateAccountAction } from "@/features/finance/actions";
import {
  publishAccountDetailsEdit,
  resetAccountEditStateForTests,
} from "@/features/finance/account-edit-store";
import {
  AccountDetailHeading,
  ManageAccountForm,
} from "@/components/accounts/ManageAccountForm";

const updateAccount = vi.mocked(updateAccountAction);

const accountId = "f269fb50-e542-4679-a478-fcf17c794b23";

const account: AccountDetail = {
  id: accountId,
  name: "QA-W-empty",
  kind: "thai_bank",
  kindLabelSv: "Thai-bank",
  currency: "THB",
  isDefault: false,
  isActive: true,
  calculatedMinor: 100,
  hasLedgerHistory: false,
  activeCount: 5,
  movements: [],
};

function setInputValue(input: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  );
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("account detail saved name", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    clearClientSessionCaches();
    resetAccountEditStateForTests();
    push.mockReset();
    updateAccount.mockReset();
    rememberAccountsSnapshot({
      accounts: [
        {
          id: accountId,
          name: "QA-W-empty",
          institution: null,
          maskedIdentifier: null,
          kind: "thai_bank",
          kindLabelSv: "Thai-bank",
          currency: "THB",
          isDefault: false,
          isActive: true,
          calculatedMinor: 100,
          thbMinor: 100,
          fxRate: 1,
          fxSource: "identity",
        },
      ],
      archivedAccounts: [],
      totalThbMinor: 100,
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    clearClientSessionCaches();
    resetAccountEditStateForTests();
  });

  it("shows the saved name in the heading and field when the RSC payload is stale", async () => {
    updateAccount.mockResolvedValue({ ok: true });
    const edit = publishAccountDetailsEdit({
      id: accountId,
      name: "QA-W-empty-z8",
      kind: "thai_bank",
      currency: "THB",
      makeDefault: false,
    });
    await edit.done;

    await act(async () => {
      root.render(
        createElement(
          "div",
          null,
          createElement(AccountDetailHeading, {
            id: account.id,
            name: account.name,
          }),
          createElement(ManageAccountForm, { account }),
        ),
      );
    });

    expect(host.querySelector("h1")?.textContent).toBe("QA-W-empty-z8");
    const input = host.querySelector("input:not([type='checkbox'])");
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect((input as HTMLInputElement).value).toBe("QA-W-empty-z8");
  });

  it("rolls the name field back to the saved name when the rename fails offline", async () => {
    updateAccount.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => {
      root.render(createElement(ManageAccountForm, { account }));
    });

    const input = host.querySelector(
      "input:not([type='checkbox'])",
    ) as HTMLInputElement;
    expect(input.value).toBe("QA-W-empty");

    await act(async () => {
      setInputValue(input, "QA-W-offline");
    });
    expect(input.value).toBe("QA-W-offline");

    await act(async () => {
      host.querySelector("form")?.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(input.value).toBe("QA-W-empty");
    expect(host.querySelector("[role='alert']")?.textContent).toBe(
      "Ingen anslutning. Inget sparades.",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
