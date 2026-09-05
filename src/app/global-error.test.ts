import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./global-error.tsx", import.meta.url), "utf8");

describe("global error boundary", () => {
  it("captures root-layout errors without rendering user data", () => {
    expect(src).toContain("Sentry.captureException(error)");
    expect(src).not.toContain("error.message");
    expect(src).not.toContain("error.stack");
  });
});
