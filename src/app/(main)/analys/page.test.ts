import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/analys loading shell", () => {
  it("streams an Analys-shaped skeleton instead of a blank header", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("AnalysViewLoading");
    expect(loading).toContain("AnalysViewLoading");
  });
});
