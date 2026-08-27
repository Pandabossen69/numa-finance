"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addMonthsKey,
  applyPlanItemEdits,
  dayOfMonthFromIso,
  dueDateInMonth,
  importableFixedExpenses,
  isPlanIncome,
  isPlanSavings,
  isRecurringMonthly,
  monthAnchorIso,
  monthKeyFromDate,
  NEXT_INCOME_NAME,
  planItemMonthKey,
  type PlanItem,
} from "@/domain/finance";
import { parseUiAmountToMinor } from "@/domain/money";
import {
  createPlanItem,
  deletePlanItem,
  getProfile,
  listPlanItems,
  setNextIncomeDate,
  updatePlanItem,
} from "@/lib/store/repository";

export type ActionResult =
  { ok: true; item?: PlanItem; items?: PlanItem[] } | { ok: false; error: string };

const kindSchema = z.enum(["mandatory", "expected", "flexible", "goal", "buffer"]);

const PAST_FIXED_LOCKED =
  "Fasta utgifter i passerade månader är låsta. Använd Klar om den redan är betald.";

function isPastMonth(monthKey: string | null, currentMonthKey: string): boolean {
  return monthKey != null && monthKey < currentMonthKey;
}

function isLockedPastFixed(
  item: PlanItem,
  timeZone: string,
  currentMonthKey: string,
) {
  if (!isRecurringMonthly(item)) return false;
  return isPastMonth(planItemMonthKey(item, timeZone), currentMonthKey);
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: kindSchema,
  amount: z.string().trim().min(1),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  monthKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const createIncomeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function revalidatePlanPaths() {
  revalidatePath("/plan");
  revalidatePath("/idag");
  revalidatePath("/analys");
}

function profileTimeZone(timezone: string | null | undefined): string {
  return timezone || "Asia/Bangkok";
}

/** Profile + plan rows only — never the full Hem snapshot. */
async function planWriteContext() {
  const [profile, planItems] = await Promise.all([getProfile(), listPlanItems()]);
  const timeZone = profileTimeZone(profile.timezone);
  return {
    profile,
    planItems,
    timeZone,
    currentMonthKey: monthKeyFromDate(new Date(), timeZone),
    currency: profile.primaryCurrency,
  };
}

export async function createPlanItemAction(
  raw: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const input = createSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor < 0) {
      return { ok: false, error: "Belopp kan inte vara negativt" };
    }
    const ctx = await planWriteContext();
    const monthKey = input.monthKey ?? ctx.currentMonthKey;
    if (isPastMonth(monthKey, ctx.currentMonthKey)) {
      return { ok: false, error: PAST_FIXED_LOCKED };
    }
    const nextDueAt = input.date
      ? `${input.date}T12:00:00.000Z`
      : dueDateInMonth(monthKey, input.dayOfMonth ?? 1);
    const item = await createPlanItem({
      name: input.name,
      kind: input.kind,
      amountMinor,
      currency: ctx.currency,
      cadence: "monthly",
      nextDueAt,
    });
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara hinken",
    };
  }
}

/** Income is date-scoped and never carries into the next month automatically. */
export async function createPlanIncomeAction(
  raw: z.infer<typeof createIncomeSchema>,
): Promise<ActionResult> {
  try {
    const input = createIncomeSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor < 0) {
      return { ok: false, error: "Belopp kan inte vara negativt" };
    }
    const ctx = await planWriteContext();
    const item = await createPlanItem({
      name: input.name,
      kind: "expected",
      amountMinor,
      currency: ctx.currency,
      cadence: "income",
      nextDueAt: `${input.date}T12:00:00.000Z`,
    });
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara intäkten",
    };
  }
}

const createExtraSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * One-off planned expense (loan, trip, etc.) — only that date/month.
 * Counts toward that month's budget and any pay-cycle covering the date.
 */
export async function createPlanExtraAction(
  raw: z.infer<typeof createExtraSchema>,
): Promise<ActionResult> {
  try {
    const input = createExtraSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor < 0) {
      return { ok: false, error: "Belopp kan inte vara negativt" };
    }
    const ctx = await planWriteContext();
    const item = await createPlanItem({
      name: input.name,
      kind: "expected",
      amountMinor,
      currency: ctx.currency,
      cadence: "once",
      nextDueAt: `${input.date}T12:00:00.000Z`,
    });
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara extra utgiften",
    };
  }
}

const savingsSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.string().trim().min(1),
});

/** Upsert month-scoped savings target (0 clears it). */
export async function setMonthSavingsAction(
  raw: z.infer<typeof savingsSchema>,
): Promise<ActionResult> {
  try {
    const input = savingsSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor < 0) {
      return { ok: false, error: "Belopp kan inte vara negativt" };
    }
    const ctx = await planWriteContext();
    const existing = ctx.planItems.find((p) => {
      if (!p.isActive || !isPlanSavings(p) || !p.nextDueAt) return false;
      return monthKeyFromDate(new Date(p.nextDueAt), ctx.timeZone) === input.monthKey;
    });

    if (amountMinor === 0) {
      if (existing) await deletePlanItem(existing.id);
      revalidatePlanPaths();
      return { ok: true };
    }

    const item = existing
      ? await updatePlanItem({ id: existing.id, amountMinor })
      : await createPlanItem({
          name: "Spara denna månad",
          kind: "goal",
          amountMinor,
          currency: ctx.currency,
          cadence: "savings",
          nextDueAt: monthAnchorIso(input.monthKey),
        });
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara sparmålet",
    };
  }
}

export async function deletePlanItemAction(id: string): Promise<ActionResult> {
  try {
    const parsedId = z.string().uuid().parse(id);
    const ctx = await planWriteContext();
    const existing = ctx.planItems.find((p) => p.id === parsedId);
    if (existing && isLockedPastFixed(existing, ctx.timeZone, ctx.currentMonthKey)) {
      return { ok: false, error: PAST_FIXED_LOCKED };
    }
    await deletePlanItem(parsedId);
    revalidatePlanPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte ta bort",
    };
  }
}

const settleSchema = z.object({
  id: z.string().uuid(),
  settled: z.boolean(),
  /** Partial amount already received/paid. Omit for full Klar. */
  amount: z.string().trim().min(1).optional(),
  /** Calendar date for the remaining amount after Delvis klar. */
  remainingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * Mark a plan income/expense occurrence Klar or Delvis klar without deleting it.
 * Allowed in every month — dates vary, so remaining figures should follow taps.
 */
export async function setPlanItemSettledAction(
  raw: z.infer<typeof settleSchema>,
): Promise<ActionResult> {
  try {
    const input = settleSchema.parse(raw);
    const ctx = await planWriteContext();
    const existing = ctx.planItems.find((p) => p.id === input.id);
    if (!existing) {
      return { ok: false, error: "Planposten hittades inte" };
    }
    if (
      isPlanSavings(existing) ||
      existing.name === NEXT_INCOME_NAME ||
      (!isPlanIncome(existing) && existing.amountMinor <= 0)
    ) {
      return { ok: false, error: "Den här posten kan inte markeras Klar." };
    }

    let settledAt: string | null = null;
    let settledMinor: number | null = null;
    let remainingDueAt: string | null = null;
    if (input.settled) {
      let minor = existing.amountMinor;
      if (input.amount != null) {
        minor = parseUiAmountToMinor(input.amount);
        if (minor < 0) {
          return { ok: false, error: "Belopp kan inte vara negativt" };
        }
      }
      if (minor <= 0) {
        settledAt = null;
        settledMinor = null;
        remainingDueAt = null;
      } else if (minor >= existing.amountMinor) {
        settledAt = new Date().toISOString();
        settledMinor = existing.amountMinor;
        remainingDueAt = null;
      } else {
        settledAt = null;
        settledMinor = minor;
        remainingDueAt = input.remainingDate
          ? `${input.remainingDate}T12:00:00.000Z`
          : (existing.remainingDueAt ?? existing.nextDueAt);
      }
    }

    const item = await updatePlanItem({
      id: input.id,
      settledAt,
      settledMinor,
      remainingDueAt,
    });
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte uppdatera Klar",
    };
  }
}

export async function setNextIncomeDateAction(date: string): Promise<ActionResult> {
  try {
    const parsed = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(date);
    const item = await setNextIncomeDate(`${parsed}T12:00:00.000Z`);
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara inkomstdatum",
    };
  }
}

export async function updatePlanItemAmountAction(raw: {
  id: string;
  amount: string;
}): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(raw.id);
    const amountMinor = parseUiAmountToMinor(raw.amount);
    if (amountMinor < 0) {
      return { ok: false, error: "Belopp kan inte vara negativt" };
    }
    const ctx = await planWriteContext();
    const existing = ctx.planItems.find((p) => p.id === id);
    if (existing && isLockedPastFixed(existing, ctx.timeZone, ctx.currentMonthKey)) {
      return { ok: false, error: PAST_FIXED_LOCKED };
    }
    const edited = existing
      ? applyPlanItemEdits(existing, { amountMinor })
      : null;
    const item = await updatePlanItem({
      id,
      amountMinor: edited?.amountMinor ?? amountMinor,
      settledAt: edited?.settledAt,
      settledMinor: edited?.settledMinor,
      remainingDueAt: edited?.remainingDueAt,
    });
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte uppdatera",
    };
  }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  kind: kindSchema.optional(),
  amount: z.string().trim().min(1).optional(),
  /** Full calendar date (`YYYY-MM-DD`) for incomes, extras, and fixed. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Day of month for recurring expenses (1–31). */
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  monthKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export async function updatePlanItemAction(
  raw: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const input = updateSchema.parse(raw);
    const amountMinor =
      input.amount != null ? parseUiAmountToMinor(input.amount) : undefined;
    if (amountMinor != null && amountMinor < 0) {
      return { ok: false, error: "Belopp kan inte vara negativt" };
    }

    const ctx = await planWriteContext();
    const existing = ctx.planItems.find((p) => p.id === input.id);
    if (existing && isLockedPastFixed(existing, ctx.timeZone, ctx.currentMonthKey)) {
      return { ok: false, error: PAST_FIXED_LOCKED };
    }

    let proposedDue: string | null | undefined;
    if (input.date) {
      proposedDue = `${input.date}T12:00:00.000Z`;
    } else if (input.dayOfMonth != null) {
      const monthKey = input.monthKey ?? ctx.currentMonthKey;
      if (isPastMonth(monthKey, ctx.currentMonthKey)) {
        return { ok: false, error: PAST_FIXED_LOCKED };
      }
      proposedDue = dueDateInMonth(monthKey, input.dayOfMonth);
    }

    const edited = existing
      ? applyPlanItemEdits(existing, {
          name: input.name,
          amountMinor,
          nextDueAt: proposedDue,
        })
      : null;

    const item = await updatePlanItem({
      id: input.id,
      name: edited?.name ?? input.name,
      kind: input.kind,
      amountMinor: edited?.amountMinor ?? amountMinor,
      nextDueAt: edited ? edited.nextDueAt : proposedDue,
      settledAt: edited?.settledAt,
      settledMinor: edited?.settledMinor,
      remainingDueAt: edited?.remainingDueAt,
    });
    revalidatePlanPaths();
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte uppdatera",
    };
  }
}

const importFixedSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
});

/** Copy previous month's fixed expenses into this month as new rows. */
export async function importFixedExpensesFromPreviousMonthAction(
  raw: z.infer<typeof importFixedSchema>,
): Promise<ActionResult> {
  try {
    const input = importFixedSchema.parse(raw);
    const ctx = await planWriteContext();
    if (input.monthKey < ctx.currentMonthKey) {
      return {
        ok: false,
        error: "Du kan bara läsa in fasta utgifter i den här månaden och framåt.",
      };
    }

    const fromMonthKey = addMonthsKey(input.monthKey, -1);
    const toCopy = importableFixedExpenses({
      items: ctx.planItems,
      fromMonthKey,
      toMonthKey: input.monthKey,
      timeZone: ctx.timeZone,
    });

    const items = await Promise.all(
      toCopy.map((src) => {
        const day = src.nextDueAt ? dayOfMonthFromIso(src.nextDueAt) : 1;
        return createPlanItem({
          name: src.name,
          kind: src.kind,
          amountMinor: src.amountMinor,
          currency: src.currency || ctx.currency,
          cadence: "monthly",
          nextDueAt: dueDateInMonth(input.monthKey, day),
        });
      }),
    );

    revalidatePlanPaths();
    return { ok: true, items };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte läsa in fasta utgifter",
    };
  }
}
