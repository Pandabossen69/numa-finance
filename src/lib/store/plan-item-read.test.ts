import { describe, expect, it, vi } from "vitest";
import { PLAN_ITEM_SELECT, PLAN_ITEM_SELECT_LEGACY } from "@/lib/supabase/selects";
import { mapPlanItem } from "./mappers";
import {
  readPlanItemsSelectingPlannedPay,
  type PlanItemColumnFlag,
} from "./plan-item-read";

const SAVED = "2026-10-08T12:00:00.000Z";

function dbRow(plannedPayAt?: string | null) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "user-1",
    name: "El",
    kind: "mandatory" as const,
    amount_minor: 200_000,
    currency: "THB" as const,
    cadence: "monthly",
    next_due_at: "2026-10-01T12:00:00.000Z",
    is_active: true,
    settled_at: null,
    settled_minor: null,
    remaining_due_at: null,
    ...(plannedPayAt === undefined ? {} : { planned_pay_at: plannedPayAt }),
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-05T00:00:00.000Z",
  };
}

describe("readPlanItemsSelectingPlannedPay", () => {
  it("returns planned_pay_at when the column exists, including the warm second call", async () => {
    const run = vi.fn(async (columns: string) => {
      expect(columns).toBe(PLAN_ITEM_SELECT);
      return { data: [dbRow(SAVED)], error: null };
    });
    let flag: PlanItemColumnFlag = null;
    const first = await readPlanItemsSelectingPlannedPay({ flag, run });
    flag = first.flag;
    const second = await readPlanItemsSelectingPlannedPay({ flag, run });

    expect(first.flag).toBe(true);
    expect(second.flag).toBe(true);
    expect(mapPlanItem(first.rows[0]!).plannedPayAt).toBe(SAVED);
    expect(mapPlanItem(second.rows[0]!).plannedPayAt).toBe(SAVED);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls.every((call) => call[0] === PLAN_ITEM_SELECT)).toBe(true);
  });

  it("falls back to the legacy select only on a missing-column error", async () => {
    for (const code of ["PGRST204", "42703"] as const) {
      const run = vi.fn(async (columns: string) => {
        if (columns === PLAN_ITEM_SELECT) {
          return {
            data: null,
            error: {
              code,
              message:
                code === "42703"
                  ? 'column "planned_pay_at" of relation "plan_items" does not exist'
                  : "Could not find the 'planned_pay_at' column of 'plan_items' in the schema cache",
            },
          };
        }
        expect(columns).toBe(PLAN_ITEM_SELECT_LEGACY);
        return { data: [dbRow()], error: null };
      });
      const read = await readPlanItemsSelectingPlannedPay({ flag: null, run });
      expect(read.flag).toBe(false);
      expect(mapPlanItem(read.rows[0]!).plannedPayAt).toBeNull();
      expect(run.mock.calls.map((call) => call[0])).toEqual([
        PLAN_ITEM_SELECT,
        PLAN_ITEM_SELECT_LEGACY,
      ]);
    }

    const warmLegacy = vi.fn(async (columns: string) => {
      expect(columns).toBe(PLAN_ITEM_SELECT_LEGACY);
      return { data: [dbRow()], error: null };
    });
    const warm = await readPlanItemsSelectingPlannedPay({
      flag: false,
      run: warmLegacy,
    });
    expect(warm.flag).toBe(false);
    expect(mapPlanItem(warm.rows[0]!).plannedPayAt).toBeNull();
    expect(warmLegacy).toHaveBeenCalledTimes(1);
  });

  it("throws other database errors and does not null the date via the legacy select", async () => {
    const run = vi.fn(async () => ({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    }));
    await expect(
      readPlanItemsSelectingPlannedPay({ flag: true, run }),
    ).rejects.toThrow(/duplicate key value/);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(PLAN_ITEM_SELECT);
  });
});
