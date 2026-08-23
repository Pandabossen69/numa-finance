import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/idag first paint", () => {
  it("streams a Hem-shaped skeleton instead of a blank column", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("HomeViewLoading");
    expect(loading).toContain("HomeViewLoading");
  });
});
