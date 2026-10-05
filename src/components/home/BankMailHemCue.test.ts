/** @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BankMailHemCue } from "@/components/home/BankMailHemCue";
import { resetBankMailPendingCountForTests } from "@/features/imports/bank-mail-pending-store";
import {
  publishBankMailPendingCount,
  seedBankMailPendingCount,
} from "@/features/imports/bank-mail-queue-refresh";
import { resetRememberedPendingBankMailCountForTests } from "@/features/home/last-snapshot-persist";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href?: string;
    children?: ReactNode;
  }) => createElement("a", { href }, children),
}));

describe("BankMailHemCue last-known paint", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    resetBankMailPendingCountForTests();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    resetBankMailPendingCountForTests();
    resetRememberedPendingBankMailCountForTests();
  });

  it("paints the last-known count in the first render, before a live read", () => {
    act(() => {
      root.render(createElement(BankMailHemCue, { knownCount: 2 }));
    });
    expect(host.textContent).toContain("Att bekräfta (2)");
  });

  it("stays empty for zero and for a user with no last-known count", () => {
    act(() => {
      root.render(createElement(BankMailHemCue, { knownCount: 0 }));
    });
    expect(host.textContent).toBe("");

    act(() => {
      root.render(createElement(BankMailHemCue, { knownCount: null }));
    });
    expect(host.textContent).toBe("");
  });

  it("drops the cue when a newer publish says nothing is waiting", () => {
    act(() => {
      root.render(createElement(BankMailHemCue, { knownCount: 2 }));
    });
    expect(host.textContent).toContain("Att bekräfta (2)");

    act(() => {
      publishBankMailPendingCount(0);
    });
    expect(host.textContent).toBe("");
  });

  it("uses a seeded count when the shell has not arrived", () => {
    seedBankMailPendingCount(1);
    act(() => {
      root.render(createElement(BankMailHemCue, { knownCount: null }));
    });
    expect(host.textContent).toContain("Att bekräfta (1)");
  });
});
