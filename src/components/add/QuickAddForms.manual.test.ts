/** @vitest-environment jsdom */

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAddForms, type ShellAccount } from "./QuickAddForms";

const stub: ShellAccount[] = [
  { id: "bb", name: "Konto", accountType: "checking", currency: "THB" },
];

const five: ShellAccount[] = [
  {
    id: "bb",
    name: "Bangkok Bank",
    accountType: "checking",
    kind: "thai_bank",
    currency: "THB",
  },
  {
    id: "kbank",
    name: "Kasikorn",
    accountType: "checking",
    kind: "thai_bank",
    currency: "THB",
  },
  {
    id: "cash",
    name: "Testkontant",
    accountType: "checking",
    kind: "cash",
    currency: "THB",
  },
  {
    id: "seb",
    name: "SEB",
    accountType: "checking",
    kind: "swedish_bank",
    currency: "SEK",
    fxRate: 3.2,
  },
  {
    id: "usd",
    name: "USD-konto",
    accountType: "checking",
    kind: "other",
    currency: "USD",
    fxRate: 33,
  },
];

function clickText(host: HTMLElement, text: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    (el) => el.textContent === text,
  );
  if (!button) throw new Error(`missing button ${text}`);
  act(() => {
    button.click();
  });
}

function chooseOption(host: HTMLElement, label: string, optionText: string) {
  const span = Array.from(host.querySelectorAll("span")).find(
    (el) => el.textContent === label,
  );
  const select = span?.parentElement?.querySelector("select");
  const option = Array.from(select?.querySelectorAll("option") ?? []).find(
    (el) => el.textContent === optionText,
  );
  if (!select || !option) throw new Error(`missing option ${optionText}`);
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    )?.set;
    setter?.call(select, option.value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function optionsFor(host: HTMLElement, label: string): string[] {
  const span = Array.from(host.querySelectorAll("span")).find(
    (el) => el.textContent === label,
  );
  const select = span?.parentElement?.querySelector("select");
  return Array.from(select?.querySelectorAll("option") ?? []).map(
    (option) => option.textContent ?? "",
  );
}

describe("Manuellt account pickers", () => {
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

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
  });

  function render(accounts: ShellAccount[]) {
    act(() => {
      root.render(
        createElement(QuickAddForms, {
          primaryAccountId: "bb",
          accounts,
        }),
      );
    });
  }

  it("shows every active account in all four modes, including after a late load", () => {
    render(stub);
    expect(optionsFor(host, "Betalat med")).toEqual(["Konto · THB"]);
    expect(host.textContent).not.toContain("Spara uttag");

    clickText(host, "Inkomst");
    expect(optionsFor(host, "Till konto")).toEqual(["Konto · THB"]);

    clickText(host, "Flytta");
    expect(host.textContent).toContain("Lägg till ett till saldo");
    expect(optionsFor(host, "Flytta")).toEqual([
      "Mellan konton",
      "Ta ut kontanter (uttag)",
    ]);
    chooseOption(host, "Flytta", "Ta ut kontanter (uttag)");
    expect(host.textContent).toContain("Skapa först ett saldo");

    render(five);

    expect(host.textContent).not.toContain("Skapa först ett saldo");
    expect(optionsFor(host, "Till kontanter")).toEqual(["Testkontant · THB"]);
    expect(optionsFor(host, "Från")).toContain("Bangkok Bank · THB");
    expect(optionsFor(host, "Från")).not.toContain("Testkontant · THB");

    chooseOption(host, "Flytta", "Mellan konton");
    expect(host.textContent).not.toContain("Lägg till ett till saldo");
    expect(optionsFor(host, "Från")).toEqual([
      "Bangkok Bank · THB",
      "Kasikorn · THB",
      "Testkontant · THB",
      "SEB · SEK",
      "USD-konto · USD",
    ]);
    expect(optionsFor(host, "Till")).toEqual([
      "Kasikorn · THB",
      "Testkontant · THB",
    ]);

    clickText(host, "Inkomst");
    expect(optionsFor(host, "Till konto")).toEqual([
      "Bangkok Bank · THB",
      "Kasikorn · THB",
      "Testkontant · THB",
      "SEB · SEK",
      "USD-konto · USD",
    ]);

    clickText(host, "Utgift");
    expect(optionsFor(host, "Betalat med")).toContain("Bangkok Bank · THB");
    expect(optionsFor(host, "Betalat med")).toContain("Testkontant · THB");
    expect(optionsFor(host, "Betalat med")).not.toContain("Kontant");
    expect(optionsFor(host, "Betalat med")).not.toContain("Konto · THB");
    expect(optionsFor(host, "Betalat med")).toHaveLength(5);
    expect(host.textContent).toContain("Spara utgift");
    expect(host.textContent).not.toContain("Spara uttag");
  });

  it("books a cash account as an expense and keeps the withdrawal under Flytta", () => {
    render(five);
    expect(optionsFor(host, "Betalat med")).toContain("Testkontant · THB");
    chooseOption(host, "Betalat med", "Testkontant · THB");
    expect(host.textContent).toContain("Spara utgift");
    expect(host.textContent).not.toContain("Spara uttag");
    expect(host.textContent).not.toContain("Till kontanter");

    clickText(host, "Flytta");
    expect(optionsFor(host, "Flytta")).toContain("Ta ut kontanter (uttag)");
    expect(host.textContent).not.toContain("Spara uttag");
    chooseOption(host, "Flytta", "Ta ut kontanter (uttag)");
    expect(host.textContent).toContain("Spara uttag");
    expect(host.textContent).toContain("Till kontanter");

    clickText(host, "Inkomst");
    clickText(host, "Utgift");
    expect(optionsFor(host, "Betalat med")).toContain("Testkontant · THB");
    expect(host.textContent).toContain("Spara utgift");
    expect(host.textContent).not.toContain("Spara uttag");
    expect(host.textContent).not.toContain("Till kontanter");
  });
});
