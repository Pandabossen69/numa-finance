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

  it("patches Hem and Rörelser locally after save instead of refreshing", () => {
    expect(src).toContain("applyLocalExpense");
    expect(src).toContain("applyLocalIncome");
    expect(src).toContain("applyLocalTransfer");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
  });

  it("paints the write before the server action and does not wrap it in useTransition", () => {
    expect(src).not.toContain("useTransition");
    expect(src).not.toContain("startTransition");
    expect(src).toContain("revertLocalExpense");
    expect(src).toContain("revertLocalIncome");
    expect(src).toContain("revertLocalTransfer");
    const expense = src.slice(
      src.indexOf("function ExpenseForm"),
      src.indexOf("function IncomeForm"),
    );
    expect(expense.indexOf("applyLocalExpense")).toBeLessThan(
      expense.indexOf("createExpenseAction"),
    );
    const income = src.slice(
      src.indexOf("function IncomeForm"),
      src.indexOf("function TransferForm"),
    );
    expect(income.indexOf("applyLocalIncome")).toBeLessThan(
      income.indexOf("createIncomeAction"),
    );
  });
});
