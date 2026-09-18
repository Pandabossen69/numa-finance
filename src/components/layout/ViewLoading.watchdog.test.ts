/** @vitest-environment jsdom */

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOAD_TIMEOUT_MESSAGE_SV } from "@/lib/async";
import { resetAnalysClientFetchForTests } from "@/features/finance/analys-client-fetch";
import { AnalysPending } from "./ViewLoading";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

afterEach(() => {
  vi.useRealTimers();
  resetAnalysClientFetchForTests();
});

async function mountPending(host: HTMLElement): Promise<Root> {
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(AnalysPending));
  });
  return root;
}

describe("AnalysPending watchdog", () => {
  it("replaces Hämtar analysen… with Swedish fail-soft after the client cap", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = await mountPending(host);
    expect(host.textContent).toContain("Hämtar analysen…");
    expect(host.textContent).not.toContain("Kunde inte hämta analysen");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });
    expect(host.textContent).toContain("Kunde inte hämta analysen");
    expect(host.textContent).toContain(LOAD_TIMEOUT_MESSAGE_SV);
    expect(host.textContent).not.toContain("Hämtar analysen…");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("fail-softs immediately on remount after the clock already expired", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const first = await mountPending(host);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });
    await act(async () => {
      first.unmount();
    });

    const second = await mountPending(host);
    expect(host.textContent).toContain("Kunde inte hämta analysen");
    expect(host.textContent).not.toContain("Hämtar analysen…");

    await act(async () => {
      second.unmount();
    });
    host.remove();
  });
});
