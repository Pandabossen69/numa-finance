import { describe, expect, it } from "vitest";
import {
  PLAN_CATEGORY_KINDS,
  PLAN_KIND_INVALID_SV,
  PLAN_SAVE_FAILED_SV,
  applySavePlanItem,
  isExpectedPlanWriteError,
  isPlanCategoryKind,
  parsePlanCategoryKind,
  planWriteUserError,
  toSafePlanLogError,
  type PlanItem,
} from "@/domain/finance";

const NOW = "2026-09-05T12:00:00.000Z";
const USER = "11111111-1111-4111-8111-111111111111";

function draft(
  kind: string | null | undefined,
  extra: Partial<Parameters<typeof applySavePlanItem>[1]> = {},
) {
  return {
    name: "Testpost",
    kind,
    amountMinor: 1_000_00,
    currency: "THB" as const,
    cadence: "monthly",
    nextDueAt: NOW,
    ...extra,
  };
}

function save(
  existing: PlanItem[],
  input: Parameters<typeof applySavePlanItem>[1],
  id = "22222222-2222-4222-8222-222222222222",
) {
  return applySavePlanItem(existing, input, {
    nowIso: NOW,
    newId: () => id,
    userId: USER,
  });
}

describe("plan category kinds", () => {
  it("lists every valid Plan type", () => {
    expect(PLAN_CATEGORY_KINDS).toEqual([
      "mandatory",
      "expected",
      "flexible",
      "goal",
      "buffer",
    ]);
  });

  it.each([...PLAN_CATEGORY_KINDS])("parses valid kind %s", (kind) => {
    expect(isPlanCategoryKind(kind)).toBe(true);
    expect(parsePlanCategoryKind(kind)).toBe(kind);
  });

  it("rejects invalid kinds with Swedish copy", () => {
    for (const value of ["income", "expense", "text", "", null, 1]) {
      expect(isPlanCategoryKind(value)).toBe(false);
      expect(() => parsePlanCategoryKind(value)).toThrow(PLAN_KIND_INVALID_SV);
    }
  });
});

describe("applySavePlanItem create + edit", () => {
  it.each([...PLAN_CATEGORY_KINDS])("creates a %s row", (kind) => {
    const item = save([], draft(kind));
    expect(item.kind).toBe(kind);
    expect(item.name).toBe("Testpost");
    expect(item.amountMinor).toBe(1_000_00);
    expect(item.userId).toBe(USER);
  });

  it.each([...PLAN_CATEGORY_KINDS])("edits an existing row to %s", (kind) => {
    const created = save([], draft("mandatory"), "aaaaaaa1-1111-4111-8111-111111111111");
    const edited = save(
      [created],
      draft(kind, { id: created.id, name: "Uppdaterad", amountMinor: 2_000_00 }),
    );
    expect(edited.id).toBe(created.id);
    expect(edited.kind).toBe(kind);
    expect(edited.name).toBe("Uppdaterad");
    expect(edited.amountMinor).toBe(2_000_00);
  });

  it("keeps the stored kind when edit omits kind", () => {
    const created = save([], draft("flexible"), "bbbbbbb1-1111-4111-8111-111111111111");
    const edited = save(
      [created],
      draft(null, { id: created.id, name: "Samma typ" }),
    );
    expect(edited.kind).toBe("flexible");
  });

  it("rejects invalid kind on create and edit", () => {
    expect(() => save([], draft("income"))).toThrow(PLAN_KIND_INVALID_SV);
    const created = save([], draft("expected"), "ccccccc1-1111-4111-8111-111111111111");
    expect(() =>
      save([created], draft("not-a-kind", { id: created.id })),
    ).toThrow(PLAN_KIND_INVALID_SV);
  });
});

describe("planWriteUserError", () => {
  it("replaces the production Postgres dumps with Swedish copy", () => {
    expect(
      planWriteUserError(
        new Error(
          'column "kind" is of type plan_category_kind but expression is of type text',
        ),
        PLAN_SAVE_FAILED_SV,
      ),
    ).toBe(PLAN_KIND_INVALID_SV);
    expect(
      planWriteUserError(
        new Error("COALESCE types text and plan_category_kind cannot be matched"),
        PLAN_SAVE_FAILED_SV,
      ),
    ).toBe(PLAN_KIND_INVALID_SV);
  });

  it("does not leak unexpected database text", () => {
    expect(
      planWriteUserError(
        new Error('column "currency" is of type currency_code but expression is of type text'),
        PLAN_SAVE_FAILED_SV,
      ),
    ).toBe(PLAN_SAVE_FAILED_SV);
  });

  it("redacts identifiers from logs", () => {
    const safe = toSafePlanLogError(
      new Error(`user 11111111-1111-4111-8111-111111111111 hugo@example.com failed`),
    );
    expect(safe.message).not.toContain("hugo@example.com");
    expect(safe.message).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(isExpectedPlanWriteError(new Error(PLAN_KIND_INVALID_SV))).toBe(true);
    expect(
      isExpectedPlanWriteError(
        new Error(
          'column "kind" is of type plan_category_kind but expression is of type text',
        ),
      ),
    ).toBe(false);
  });
});
