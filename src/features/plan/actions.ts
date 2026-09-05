"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  addMonthsKey,
  applyPlanItemEdits,
  dayOfMonthFromIso,
  dueDateInMonth,
  importableFixedExpenses,
  isPlanIncome,
  isPlanSavings,
  monthAnchorIso,
  monthKeyFromDate,
  NEXT_INCOME_NAME,
  planSettleTargetMinor,
  planAmountBelowSettledError,
  type PlanItem,
} from "@/domain/finance";
import { parseUiAmountToMinor } from "@/domain/money";
import { NUMA_MENU_SNAPSHOT_TAG } from "@/lib/supabase/cache-tags";
import {
  createPlanItem,
  deletePlanItem,
  getProfile,
  linkTransactionToPlanItem,
  listPlanItems,
  refreshTodaySnapshot,
  setNextIncomeDate,
  settlePlanItemAtomic,
  updatePlanItem,
} from "@/lib/store/repository";
import {
  type PlanSettleLedgerResult,
} from "@/features/plan/sync-settle-ledger";
import { reportError } from "@/lib/observe/report";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  accountsSnapshotFromToday,
  homeSnapshotFromToday,
  movementsSnapshotFromToday,
  planSnapshotFromToday,
} from "@/features/finance/snapshot-from-today";

export type { PlanSettleLedgerResult };

export type ActionResult =
  | {
      ok: true;
      item?: PlanItem;
      items?: PlanItem[];
      settleLedger?: PlanSettleLedgerResult;
      refreshPending?: boolean;
      refreshPendingMessage?: string;
      home?: HomeSnapshot;
      plan?: PlanSnapshot;
      accounts?: AccountsSnapshot;
      movements?: MovementsSnapshot;
    }
  | { ok: false; error: string };

const kindSchema = z.enum(["mandatory", "expected", "flexible", "goal", "buffer"]);

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

/**
 * Mark plan-derived caches stale without re-rendering the current route.
 *
 * Calling Next path-revalidation helpers from a Server Action ships a full RSC
 * Flight payload in the same HTTP response. On desktop that hard-locks the tab
 * right after Save; on phone it freezes. The row is already in Supabase and
 * PlanEditor already patched locally — so refreshing /plan|/idag|/analys in
 * the action only races the optimistic tree (and can look like
 * "crashed but saved").
 *
 * Tabs are force-dynamic; the next visit is fresh. Same pattern as money saves
 * and settle (`revalidateSettleCaches`).
 */
function revalidatePlanPaths() {
  revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");
}

/** Settle writes a ledger row. Do not ship a full RSC Flight payload — cards update locally. */
function revalidateSettleCaches() {
  revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");
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
  accountId: z.string().uuid().optional(),
  clientMutationId: z.string().uuid().optional(),
  /**
   * Cumulative settled total so far (absolute), in UI amount form.
   * Omit for full Klar (settled=true) or when undoing (settled=false).
   * Callers that collect "how much NOW" must add already-settled first.
   */
  targetSettledAmount: z.string().trim().min(1).optional(),
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

    let requestedMinor: number | null = null;
    if (input.settled) {
      if (input.targetSettledAmount != null) {
        requestedMinor = parseUiAmountToMinor(input.targetSettledAmount);
        if (requestedMinor < 0) {
          return { ok: false, error: "Belopp kan inte vara negativt" };
        }
      } else {
        requestedMinor = existing.amountMinor;
      }
    } else {
      requestedMinor = 0;
    }

    const targetBookedMinor = planSettleTargetMinor(existing, {
      settled: input.settled,
      requestedMinor,
    });
    const remainingDueAt =
      input.settled &&
      targetBookedMinor > 0 &&
      targetBookedMinor < existing.amountMinor
        ? input.remainingDate
          ? `${input.remainingDate}T12:00:00.000Z`
          : (existing.remainingDueAt ?? existing.nextDueAt)
        : null;

    const atomic = await settlePlanItemAtomic({
      itemId: input.id,
      settled: input.settled && targetBookedMinor > 0,
      targetSettledMinor: targetBookedMinor,
      remainingDueAt,
      accountId: input.accountId ?? null,
      clientMutationId: input.clientMutationId ?? null,
    });
    try {
      const snap = await refreshTodaySnapshot();
      revalidateSettleCaches();
      return {
        ok: true,
        item: atomic.item,
        settleLedger: {
          bookedMinor: atomic.bookedMinor,
          saldoDeltaMinor: atomic.saldoDeltaMinor,
          accountId: atomic.accountId,
          skippedBecauseFunded: atomic.skippedBecauseFunded,
        },
        home: homeSnapshotFromToday(snap),
        plan: planSnapshotFromToday(snap),
        accounts: accountsSnapshotFromToday(snap),
        movements: movementsSnapshotFromToday(snap),
      };
    } catch {
      revalidateSettleCaches();
      return {
        ok: true,
        item: atomic.item,
        refreshPending: true,
        refreshPendingMessage: "Sparat. Uppdaterar siffrorna…",
        settleLedger: {
          bookedMinor: atomic.bookedMinor,
          saldoDeltaMinor: atomic.saldoDeltaMinor,
          accountId: atomic.accountId,
          skippedBecauseFunded: atomic.skippedBecauseFunded,
        },
      };
    }
  } catch (error) {
    void reportError("mutation.settle", error, { itemId: raw.id });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte uppdatera Klar",
    };
  }
}

export async function confirmPlanLinkAction(raw: {
  transactionId: string;
  itemId: string;
  clientMutationId?: string;
}): Promise<ActionResult> {
  try {
    const transactionId = z.string().uuid().parse(raw.transactionId);
    const itemId = z.string().uuid().parse(raw.itemId);
    const clientMutationId = raw.clientMutationId
      ? z.string().uuid().parse(raw.clientMutationId)
      : undefined;
    const linked = await linkTransactionToPlanItem({
      transactionId,
      itemId,
      clientMutationId,
    });
    try {
      const snap = await refreshTodaySnapshot();
      revalidateSettleCaches();
      return {
        ok: true,
        item: linked.item,
        home: homeSnapshotFromToday(snap),
        plan: planSnapshotFromToday(snap),
        accounts: accountsSnapshotFromToday(snap),
        movements: movementsSnapshotFromToday(snap),
      };
    } catch {
      revalidateSettleCaches();
      return {
        ok: true,
        item: linked.item,
        refreshPending: true,
        refreshPendingMessage: "Sparat. Uppdaterar siffrorna…",
      };
    }
  } catch (error) {
    void reportError("mutation.link", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte koppla transaktionen",
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
    if (existing) {
      const belowErr = planAmountBelowSettledError(existing, amountMinor);
      if (belowErr) return { ok: false, error: belowErr };
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
    if (existing && amountMinor != null) {
      const belowErr = planAmountBelowSettledError(existing, amountMinor);
      if (belowErr) return { ok: false, error: belowErr };
    }

    let proposedDue: string | null | undefined;
    if (input.date) {
      proposedDue = `${input.date}T12:00:00.000Z`;
    } else if (input.dayOfMonth != null) {
      const monthKey = input.monthKey ?? ctx.currentMonthKey;
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
