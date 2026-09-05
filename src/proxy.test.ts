import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./proxy.ts", import.meta.url), "utf8");

describe("auth proxy matcher", () => {
  it("lets the Sentry tunnel and isolated test route skip the login gate", () => {
    expect(src).toContain("sentry-tunnel");
    expect(src).toContain("api/internal/sentry-test");
  });
});
