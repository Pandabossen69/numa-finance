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
    expect(src).toContain("ChipStrip");
    expect(src).toContain("numa-category-chip");
    expect(src).toContain("Föregående kategorier");
    expect(src).toContain("Nästa kategorier");
    expect(src).toContain("min-h-11");
    expect(src).not.toContain("min-h-10");
  });

  it("patches Hem and Rörelser before the server, then reconciles", () => {
    expect(src).toContain("paintOptimisticQuickAdd");
    expect(src).toContain("rollbackOptimisticQuickAdd");
    expect(src).toContain("confirmOptimisticQuickAdd");
    expect(src).toContain("clientMutationId: mutationId");
    expect(src).toContain("useSubmitGuard");
    expect(src).toContain("confirmOptimisticFinance");
    expect(src).toContain("createExpenseAction");
    expect(src).toContain("applyLocalTransfer");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
    const expenseBlock = src.slice(
      src.indexOf("function ExpenseForm"),
      src.indexOf("function IncomeForm"),
    );
    expect(expenseBlock.indexOf("paintOptimisticQuickAdd")).toBeLessThan(
      expenseBlock.indexOf("onSuccess?.()"),
    );
    expect(expenseBlock.indexOf("onSuccess?.()")).toBeLessThan(
      expenseBlock.indexOf("await createExpenseAction"),
    );
    expect(expenseBlock).toContain("setError(result.error)");
    const incomeBlock = src.slice(
      src.indexOf("function IncomeForm"),
      src.indexOf("function TransferForm"),
    );
    expect(incomeBlock.indexOf("paintOptimisticQuickAdd")).toBeLessThan(
      incomeBlock.indexOf("onSuccess?.()"),
    );
    expect(incomeBlock.indexOf("onSuccess?.()")).toBeLessThan(
      incomeBlock.indexOf("await createIncomeAction"),
    );
    expect(incomeBlock).toContain("setError(result.error)");
    const transferBlock = src.slice(src.indexOf("function TransferForm"));
    expect(transferBlock.indexOf("onSuccess?.()")).toBeGreaterThan(
      transferBlock.indexOf("await createTransferAction"),
    );
    expect(transferBlock).toContain("compatibleDestinations");
    expect(transferBlock).toContain("olika valutor stöds inte ännu");
    expect(transferBlock).toContain("createStableMutationId");
    expect(transferBlock).toContain("mutation.take()");
    expect(transferBlock).toContain("clientMutationId: mutationId");
    expect(transferBlock).toContain("mutation.clear()");
    expect(transferBlock.indexOf("if (!result.ok)")).toBeLessThan(
      transferBlock.indexOf("mutation.clear()"),
    );
    expect(transferBlock).toContain("appliedMutations");
    expect(transferBlock).toContain("adoptMutationFinance");
    const cashBlock = src.slice(src.indexOf("function CashForm"));
    expect(cashBlock).toContain("createStableMutationId");
    expect(cashBlock).toContain("mutation.take()");
    expect(cashBlock).toContain("clientMutationId: mutationId");
    expect(cashBlock).toContain("mutation.clear()");
    expect(cashBlock.indexOf("if (!result.ok)")).toBeLessThan(
      cashBlock.indexOf("mutation.clear()"),
    );
    expect(cashBlock).toContain("appliedMutations");
    expect(cashBlock).toContain("adoptMutationFinance");
  });
});
