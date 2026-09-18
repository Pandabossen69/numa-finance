import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportError } from "./report";

describe("reportError timeout classification", () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

  beforeEach(() => {
    vi.stubEnv("SENTRY_DSN", "https://abc123@sentry.example/1");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not ingest expected snapshot timeouts as Sentry errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await reportError(
      "loader.home",
      new Error("getTodaySnapshot timed out after 3000ms"),
    );
    await reportError(
      "loader.plan",
      new Error("getTodaySnapshot timed out after 3000ms"),
    );
    await reportError(
      "loader.analys",
      new Error("getTodaySnapshot timed out after 3000ms"),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0]?.[0]).toBe("[numa] loader.home timed out");

    warn.mockRestore();
    error.mockRestore();
  });

  it("still reports unexpected loader failures as Sentry errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await reportError(
      "loader.analys",
      new Error("relation numa.accounts does not exist"),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as {
      level: string;
      tags: { scope: string };
      exception: { values: Array<{ value: string }> };
    };
    expect(body.level).toBe("error");
    expect(body.tags.scope).toBe("loader.analys");
    expect(body.exception.values[0]?.value).toBe(
      "relation numa.accounts does not exist",
    );

    error.mockRestore();
  });

  it("does not treat an ordinary timeout-ish message as a circuit-breaker skip", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await reportError("ocr.upload", new Error("storage timeout"));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { level: string };
    expect(body.level).toBe("error");

    error.mockRestore();
  });
});
