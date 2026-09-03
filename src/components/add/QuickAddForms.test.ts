import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./QuickAddForms.tsx", import.meta.url), "utf8");

describe("Flytta/Kontant empty copy", () => {
  it("uses the Mer → Saldo path, not Mina saldon", () => {
    expect(src).toContain("SV.merPathSaldo");
    expect(src).not.toMatch(/Mina saldon/);
  });

  it("keeps mode chips equal and category chips the same 44px size", () => {
    expect(src).toContain("numa-equal-chips is-quad");
    expect(src).toContain("numa-chip-scroll");
    expect(src).toContain("min-h-11");
    expect(src).not.toContain("min-h-10");
  });

  it("patches Hem locally but confirms server before navigation on money writes", () => {
    expect(src).toContain("applyOptimisticHomeSpend");
    expect(src).toContain("applyOptimisticIncomeLanding");
    expect(src).toContain("applyAccountDelta");
    expect(src).toContain("applyMovementsAdd");
    expect(src).toContain("confirmOptimisticFinance");
    expect(src).toContain("createExpenseAction");
    expect(src).toContain("applyLocalTransfer");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
    const expenseBlock = src.slice(src.indexOf("function ExpenseForm"));
    expect(expenseBlock.indexOf("onSuccess?.()")).toBeGreaterThan(
      expenseBlock.indexOf("await createExpenseAction"),
    );
    const transferBlock = src.slice(src.indexOf("function TransferForm"));
    expect(transferBlock.indexOf("onSuccess?.()")).toBeGreaterThan(
      transferBlock.indexOf("await createTransferAction"),
    );
    expect(transferBlock).toContain("compatibleDestinations");
    expect(transferBlock).toContain("olika valutor stöds inte ännu");
  });
});
