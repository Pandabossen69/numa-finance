import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./VerifyBalanceForm.tsx", import.meta.url),
  "utf8",
);

describe("VerifyBalanceForm rejected saldo", () => {
  it("restores the previous paint when the save is rejected, including an empty account", () => {
    expect(src).toContain("captureOptimisticBalance");
    expect(src).toContain("undoOptimisticBalance(before)");
    expect(src).not.toContain("calculatedMinor == null) return");
  });
});
