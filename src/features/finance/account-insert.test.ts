import { describe, expect, it } from "vitest";
import { accountInsertFailure } from "./account-insert";

const MUTATION = "11111111-1111-4111-8111-111111111111";

describe("account insert idempotency", () => {
  it("treats 23505 on the mutation index as already saved", () => {
    expect(
      accountInsertFailure({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "numa_accounts_user_client_mutation_unique"',
      }),
    ).toBe("replay");
    expect(
      accountInsertFailure({
        message: `duplicate key value violates unique constraint (user_id, client_mutation_id) ${MUTATION}`,
      }),
    ).toBe("replay");
  });

  it("retries once without client_mutation_id when the column is missing", () => {
    expect(
      accountInsertFailure({
        code: "PGRST204",
        message:
          "Could not find the 'client_mutation_id' column of 'accounts' in the schema cache",
      }),
    ).toBe("omit-column");
    expect(
      accountInsertFailure({
        code: "42703",
        message: 'column "client_mutation_id" of relation "accounts" does not exist',
      }),
    ).toBe("omit-column");
  });

  it("does not hide an unrelated insert error", () => {
    expect(
      accountInsertFailure({
        code: "23502",
        message: "null value in column \"name\" violates not-null constraint",
      }),
    ).toBe("fail");
  });
});
