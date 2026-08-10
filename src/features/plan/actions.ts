"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseUiAmountToMinor } from "@/domain/money";
import {
  createPlanItem,
  deletePlanItem,
  getTodaySnapshot,
  setNextIncomeDate,
  updatePlanItem,
} from "@/lib/store/repository";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const kindSchema = z.enum([
  "mandatory",
  "expected",
  "flexible",
  "goal",
  "buffer",
]);

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: kindSchema,
  amount: z.string().trim().min(1),
});

function revalidatePlanPaths() {
  revalidatePath("/plan");
  revalidatePath("/idag");
  revalidatePath("/analys");
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
    const snap = await getTodaySnapshot();
    await createPlanItem({
      name: input.name,
      kind: input.kind,
      amountMinor,
      currency: snap.currency,
      cadence: "monthly",
      // Fixed/monthly buckets roll forward automatically into upcoming months.
      nextDueAt: new Date().toISOString(),
    });
    revalidatePlanPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara hinken",
    };
  }
}

export async function deletePlanItemAction(id: string): Promise<ActionResult> {
  try {
    await deletePlanItem(z.string().uuid().parse(id));
    revalidatePlanPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte ta bort",
    };
  }
}

export async function setNextIncomeDateAction(
  date: string,
): Promise<ActionResult> {
  try {
    const parsed = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(date);
    await setNextIncomeDate(`${parsed}T12:00:00.000Z`);
    revalidatePlanPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte spara inkomstdatum",
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
    await updatePlanItem({ id, amountMinor });
    revalidatePlanPaths();
    return { ok: true };
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
    await updatePlanItem({
      id: input.id,
      name: input.name,
      kind: input.kind,
      amountMinor,
    });
    revalidatePlanPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte uppdatera",
    };
  }
}
