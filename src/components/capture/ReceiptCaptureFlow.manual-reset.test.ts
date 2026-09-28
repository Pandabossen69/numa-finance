/** @vitest-environment jsdom */

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShellAccount } from "@/components/add/QuickAddForms";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/fota",
}));

vi.mock("@/features/finance/actions", () => ({
  createExpenseAction: vi.fn(async () => ({ ok: true, id: "tx-1" })),
  createIncomeAction: vi.fn(),
  createTransferAction: vi.fn(),
  createCashWithdrawalAction: vi.fn(),
}));

import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";

const thai: ShellAccount = {
  id: "thai",
  name: "Thai-bank",
  accountType: "checking",
  currency: "THB",
};

const cash: ShellAccount = {
  id: "cash",
  name: "Testkontant",
  accountType: "checking",
  kind: "cash",
  currency: "THB",
};

function selectValue(host: HTMLElement): string {
  const select = host.querySelector("select");
  if (!(select instanceof HTMLSelectElement)) throw new Error("missing select");
  return select.value;
}

function setSelect(host: HTMLElement, value: string) {
  const select = host.querySelector("select");
  if (!(select instanceof HTMLSelectElement)) throw new Error("missing select");
  const proto = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  );
  proto?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setAmount(host: HTMLElement, value: string) {
  const input = host.querySelector('input[inputmode="decimal"], input[type="text"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("missing amount");
  const proto = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  );
  proto?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Fota Manuellt resets after a successful save", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
  });

  it("returns to the picker and the default account, not the last choice", async () => {
    await act(async () => {
      root.render(
        createElement(ReceiptCaptureFlow, {
          accountId: thai.id,
          accounts: [thai, cash],
          remainingTodayMinor: 1_000,
          currency: "THB",
          initialMode: "manual",
        }),
      );
    });

    expect(host.textContent).toContain("Manuellt");
    expect(selectValue(host)).toBe(thai.id);

    await act(async () => {
      setSelect(host, cash.id);
      setAmount(host, "12");
    });
    expect(selectValue(host)).toBe(cash.id);

    await act(async () => {
      host.querySelector("form")?.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Fota");
    expect(host.textContent).not.toContain("Spara utgift");

    const manual = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Manuellt"),
    );
    expect(manual).toBeTruthy();
    await act(async () => {
      manual?.click();
    });

    expect(host.textContent).toContain("Spara utgift");
    expect(selectValue(host)).toBe(thai.id);
  });
});
