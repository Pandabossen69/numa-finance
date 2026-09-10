import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./RepairAppButton.tsx", import.meta.url), "utf8");

describe("RepairAppButton", () => {
  it("uses the same Hem navigation + click lock as /laga", () => {
    expect(src).toContain('navigateAfterRepair("/idag")');
    expect(src).toContain("shouldAcceptRepairStart");
    expect(src).toContain("repairStartedRef");
    expect(src).toContain("Öppna Hem");
    expect(src).toContain('href="/idag"');
    expect(src).not.toContain("SKIP_WAITING");
    expect(src).not.toContain("location.replace");
  });
});
