import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const instrumentation = readFileSync(
  new URL("./instrumentation.ts", import.meta.url),
  "utf8",
);
const client = readFileSync(
  new URL("./instrumentation-client.ts", import.meta.url),
  "utf8",
);
const server = readFileSync(
  new URL("./sentry.server.config.ts", import.meta.url),
  "utf8",
);
const edge = readFileSync(new URL("./sentry.edge.config.ts", import.meta.url), "utf8");

describe("Sentry runtime wiring", () => {
  it("registers server, edge, and request-error capture", () => {
    expect(instrumentation).toContain('NEXT_RUNTIME === "nodejs"');
    expect(instrumentation).toContain('NEXT_RUNTIME === "edge"');
    expect(instrumentation).toContain("Sentry.captureRequestError");
  });

  it("initializes every runtime from env-based options", () => {
    for (const src of [client, server, edge]) {
      expect(src).toContain("getSentryInitOptions");
      expect(src).toContain("Sentry.init");
      expect(src).not.toMatch(/https:\/\/[^"'` ]+@o\d+\.ingest/);
    }
  });
});
