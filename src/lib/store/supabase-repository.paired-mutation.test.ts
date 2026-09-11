import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./supabase-repository.ts", import.meta.url),
  "utf8",
);

describe("supabase paired money-move idempotency", () => {
  it("looks up the complete pair, keys only the debit, and replays unique violations", () => {
    const transfer = src.slice(
      src.indexOf("export async function createTransfer"),
      src.indexOf("export async function createCashWithdrawal"),
    );
    const cash = src.slice(
      src.indexOf("export async function createCashWithdrawal"),
      src.indexOf("export async function listTransactions"),
    );
    for (const block of [transfer, cash]) {
      expect(block).toContain("findPairedMoneyMoveByMutationId");
      expect(block).toContain("client_mutation_id: input.clientMutationId ?? null");
      expect(block).toContain("isUniqueViolationMessage");
      expect(block).toContain(".insert([");
      const debitKey = block.indexOf(
        "client_mutation_id: input.clientMutationId ?? null",
      );
      const creditDirection = block.lastIndexOf('direction: "credit"');
      expect(debitKey).toBeGreaterThan(-1);
      expect(creditDirection).toBeGreaterThan(debitKey);
      expect(
        block.indexOf("client_mutation_id: input.clientMutationId ?? null", debitKey + 1),
      ).toBe(-1);
    }
  });
});
