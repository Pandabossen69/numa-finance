import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => {
  const captureException = vi.fn();
  const setTag = vi.fn();
  const setContext = vi.fn();
  const withScope = vi.fn(
    (
      callback: (scope: { setTag: typeof setTag; setContext: typeof setContext }) => void,
    ) => {
      callback({ setTag, setContext });
    },
  );
  return { captureException, setTag, setContext, withScope };
});

vi.mock("@sentry/nextjs", () => sentryMocks);

import { reportError, sanitizeReportExtra } from "./report";

describe("sanitizeReportExtra", () => {
  it("keeps allowlisted ids and drops financial fields", () => {
    expect(
      sanitizeReportExtra({
        itemId: "abc-1",
        amount: 12500,
        description: "Hyra",
        email: "hugo@example.com",
      }),
    ).toEqual({ itemId: "abc-1" });
  });

  it("returns undefined when nothing safe remains", () => {
    expect(sanitizeReportExtra({ saldo: 1, token: "x" })).toBeUndefined();
  });
});

describe("reportError", () => {
  beforeEach(() => {
    sentryMocks.captureException.mockClear();
    sentryMocks.setTag.mockClear();
    sentryMocks.setContext.mockClear();
    sentryMocks.withScope.mockClear();
  });

  it("sends the exception with a scope tag and sanitized extra", async () => {
    const error = new Error("boom");
    await reportError("mutation.settle", error, {
      itemId: "item-9",
      amount: 99,
    });
    expect(sentryMocks.setTag).toHaveBeenCalledWith("numa.scope", "mutation.settle");
    expect(sentryMocks.setContext).toHaveBeenCalledWith("numa", {
      itemId: "item-9",
    });
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
  });
});
