import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./openai-vision.ts", import.meta.url), "utf8");

describe("vision categoryHint prompt", () => {
  it("lets Resor, Travel, and Transport come back instead of falling through to Mat", () => {
    expect(src).toContain("Resor, or Travel");
    expect(src).toContain("AirAsia");
    expect(src).toContain("never null and never Mat");
    expect(src).toContain("categoryHint");
    expect(src).not.toContain(
      "categoryHint: one of Mat, Transport, Shopping, Boende, Övrigt",
    );
  });

  it("asks for ISO 8601 local time and an ISO currency code", () => {
    expect(src).toContain("ISO 8601 local time");
    expect(src).toContain("YYYY-MM-DDTHH:mm");
    expect(src).toContain("ISO 4217");
    expect(src).not.toContain("occurredAt as ISO minute");
  });
});
