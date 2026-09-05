import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./route-islands.tsx", import.meta.url), "utf8");

describe("route islands", () => {
  it("code-splits Hem, Plan and Analys but still SSRs the dest shell", () => {
    expect(src).toContain("next/dynamic");
    const main = src.slice(
      src.indexOf("export const HomeDashboard"),
      src.indexOf("export const ReceiptCaptureFlow"),
    );
    expect(main).toContain("ssr: true");
    expect(main).not.toContain("ssr: false");
    expect(src).toContain("HomeDashboard");
    expect(src).toContain("PlanEditor");
    expect(src).toContain("PlanScreen");
    expect(src).toContain("AnalysDashboard");
  });
});
