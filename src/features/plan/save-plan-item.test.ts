import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_CATEGORY_KINDS } from "@/domain/finance";
import {
  adoptServerPlanItems,
  isTempPlanId,
  optimisticPlanItem,
  removeItemById,
  replaceItemById,
} from "./optimistic";
import type { PlanItem } from "@/domain/finance";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const editor = readFileSync(
  new URL("../../components/plan/PlanEditor.tsx", import.meta.url),
  "utf8",
);
const remote = readFileSync(
  new URL("../../lib/store/supabase-repository.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260905140000_save_plan_item_kind_cast.sql",
    import.meta.url,
  ),
  "utf8",
);
const previousMutation = readFileSync(
  new URL(
    "../../../supabase/migrations/20260904120000_p0_currency_alloc_mutations.sql",
    import.meta.url,
  ),
  "utf8",
);

function item(partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor">): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name ?? "x",
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? "2026-09-01T12:00:00.000Z",
    isActive: partial.isActive ?? true,
    createdAt: partial.createdAt ?? "2026-09-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-09-01T00:00:00.000Z",
  };
}

describe("save_plan_item migration types kind safely", () => {
  it("casts and validates against numa.plan_category_kind on insert and update", () => {
    expect(migration).toContain("v_kind numa.plan_category_kind");
    expect(migration).toContain("btrim(p_kind)::numa.plan_category_kind");
    expect(migration).toContain("invalid_text_representation");
    expect(migration).toContain("Ogiltig plantyp");
    expect(migration).toContain("kind = coalesce(v_kind, kind)");
    expect(migration).not.toContain("kind = coalesce(p_kind, kind)");
    expect(migration).toContain("v_uid, btrim(p_name), v_kind, p_amount_minor, v_currency");
    expect(migration).not.toContain("v_uid, btrim(p_name), p_kind, p_amount_minor, p_currency");
  });

  it("does not rewrite the already-applied mutation migration", () => {
    expect(previousMutation).toContain("kind = coalesce(p_kind, kind)");
    expect(previousMutation).toContain("v_uid, btrim(p_name), p_kind, p_amount_minor, p_currency");
  });
});

describe("plan save actions hide Postgres text", () => {
  it("maps create and update failures through planWriteUserError", () => {
    const create = actions.slice(
      actions.indexOf("export async function createPlanItemAction"),
      actions.indexOf("export async function createPlanIncomeAction"),
    );
    const income = actions.slice(
      actions.indexOf("export async function createPlanIncomeAction"),
      actions.indexOf("export async function createPlanExtraAction"),
    );
    const extra = actions.slice(
      actions.indexOf("export async function createPlanExtraAction"),
      actions.indexOf("export async function setMonthSavingsAction"),
    );
    const update = actions.slice(
      actions.indexOf("export async function updatePlanItemAction"),
      actions.indexOf("export async function importFixedExpensesFromPreviousMonthAction"),
    );
    for (const slice of [create, income, extra, update]) {
      expect(slice).toContain("planWriteFailure");
      expect(slice).not.toContain("error instanceof Error ? error.message");
    }
    expect(actions).toContain('void reportError("mutation.plan"');
    expect(actions).toContain("toSafePlanLogError");
  });

  it("leaves savings on its previous error path", () => {
    const savings = actions.slice(
      actions.indexOf("export async function setMonthSavingsAction"),
      actions.indexOf("export async function deletePlanItemAction"),
    );
    expect(savings).not.toContain("planWriteFailure");
    expect(savings).toContain("error instanceof Error ? error.message");
  });

  it("validates kind before the RPC", () => {
    const create = remote.slice(
      remote.indexOf("export async function createPlanItem"),
      remote.indexOf("export async function updatePlanItem"),
    );
    const update = remote.slice(
      remote.indexOf("export async function updatePlanItem"),
      remote.indexOf("export async function settlePlanItemAtomic"),
    );
    expect(create).toContain("parsePlanCategoryKind(input.kind)");
    expect(update).toContain("parsePlanCategoryKind(input.kind)");
  });

  it("covers every valid Plan type in the action schema", () => {
    for (const kind of PLAN_CATEGORY_KINDS) {
      expect(actions).toContain(`"${kind}"`);
    }
    expect(actions).toContain(
      'z.enum(["mandatory", "expected", "flexible", "goal", "buffer"])',
    );
  });
});

describe("failed plan save does not leave an optimistic row", () => {
  it("reverts a failed create back to the previous list", () => {
    const existing = item({
      id: "keep",
      kind: "mandatory",
      amountMinor: 800_00,
    });
    const created = optimisticPlanItem({
      name: "Ny intäkt",
      kind: "expected",
      amountMinor: 10_000_00,
      currency: "THB",
      cadence: "income",
      nextDueAt: "2026-09-05T12:00:00.000Z",
    });
    const applied = [...[existing], created];
    expect(applied.some((row) => isTempPlanId(row.id))).toBe(true);
    const reverted = removeItemById([existing], created.id);
    expect(reverted.map((row) => row.id)).toEqual(["keep"]);
    expect(reverted.some((row) => isTempPlanId(row.id))).toBe(false);
    expect(adoptServerPlanItems(reverted, [existing, created])).toEqual([
      existing,
    ]);
  });

  it("restores the previous row after a failed edit", () => {
    const previous = item({
      id: "row",
      kind: "expected",
      amountMinor: 5_000_00,
      name: "Lön",
    });
    const optimistic = { ...previous, name: "Ny lön", amountMinor: 6_000_00 };
    const applied = replaceItemById([previous], previous.id, optimistic);
    expect(applied[0]?.name).toBe("Ny lön");
    const reverted = replaceItemById(applied, previous.id, previous);
    expect(reverted[0]).toEqual(previous);
  });

  it("keeps the editor on revert(base) after a failed mutation", () => {
    expect(editor).toContain("setLocalItems(opts.revert(base))");
    expect(editor).toContain("removeItemById(rows, created.id)");
    expect(editor).toContain("replaceItemById(rows, id, previous)");
    expect(editor).toContain("planWriteUserError");
    expect(editor).not.toContain("setError(result.error)");
    expect(editor).not.toContain("err instanceof Error ? err.message");
  });
});
