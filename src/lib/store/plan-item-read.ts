import { isMissingPlannedPayColumn } from "@/domain/finance";
import { PLAN_ITEM_SELECT, PLAN_ITEM_SELECT_LEGACY } from "@/lib/supabase/selects";

export type PlanItemColumnFlag = boolean | null;

type ProbeError = {
  code?: string | null;
  message?: string | null;
};

type ProbeResult<T> = {
  data: T[] | null;
  error: ProbeError | null;
};

type Probe<T> = PromiseLike<ProbeResult<T>>;

/**
 * Full select while the column is known or not yet probed.
 * Legacy select only after a missing-column error (42703 / PGRST204).
 */
export async function readPlanItemsSelectingPlannedPay<T extends object>(input: {
  flag: PlanItemColumnFlag;
  run: (columns: string) => Probe<T>;
}): Promise<{
  rows: Array<T & { planned_pay_at: string | null }>;
  flag: boolean;
}> {
  if (input.flag !== false) {
    const withPay = await input.run(PLAN_ITEM_SELECT);
    if (!withPay.error) {
      return {
        rows: (withPay.data ?? []) as Array<T & { planned_pay_at: string | null }>,
        flag: true,
      };
    }
    if (!isMissingPlannedPayColumn(withPay.error)) {
      throw new Error(withPay.error.message ?? "Kunde inte läsa planposter");
    }
  }

  const plain = await input.run(PLAN_ITEM_SELECT_LEGACY);
  if (plain.error) throw new Error(plain.error.message ?? "Kunde inte läsa planposter");
  return {
    rows: (plain.data ?? []).map((row) => ({ ...row, planned_pay_at: null })),
    flag: false,
  };
}
