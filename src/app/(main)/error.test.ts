import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./error.tsx", import.meta.url), "utf8");

describe("main error boundary", () => {
  it("reports the caught render error to Sentry", () => {
    expect(src).toContain("Sentry.captureException(error)");
    expect(src).toContain("useEffect");
  });
});
