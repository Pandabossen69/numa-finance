"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createAccount,
  createCheckpoint,
  createManualExpense,
  createScreenshotObservation,
  getTodaySnapshot,
  recordOnTrackDayIfNeeded,
} from "@/lib/store/repository";
import { calculateDayPulse } from "@/domain/gamification";
import { money, parseUiAmountToMinor } from "@/domain/money";

const accountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  institution: z.string().trim().max(80).optional().nullable(),
  accountType: z.enum([
    "checking",
    "savings",
    "cash",
    "credit",
    "investment",
    "other",
  ]),
  currency: z.enum(["THB", "SEK"]),
  maskedIdentifier: z.string().trim().max(32).optional().nullable(),
  openingBalance: z.string().trim().min(1),
  makeDefault: z.boolean().optional(),
});

const expenseSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.string().trim().min(1),
  description: z.string().trim().max(120).optional(),
  category: z.string().trim().max(40).optional().nullable(),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createAccountAction(
  raw: z.infer<typeof accountSchema>,
): Promise<ActionResult> {
  try {
    const input = accountSchema.parse(raw);
    const openingMinor = parseUiAmountToMinor(input.openingBalance);
    if (openingMinor < 0) {
      return { ok: false, error: "Ingående saldo kan inte vara negativt" };
    }

    const account = await createAccount({
      name: input.name,
      institution: input.institution,
      accountType: input.accountType,
      currency: input.currency,
      maskedIdentifier: input.maskedIdentifier,
      makeDefault: input.makeDefault ?? true,
    });

    await createCheckpoint({
      accountId: account.id,
      balanceMinor: openingMinor,
      source: "manual_opening_balance",
      note: "Ingående / verifierat saldo",
    });

    revalidatePath("/idag");
    revalidatePath("/konton");
    revalidatePath("/transaktioner");
    revalidatePath("/mer");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte skapa konto",
    };
  }
}

export async function createExpenseAction(
  raw: z.infer<typeof expenseSchema>,
): Promise<ActionResult> {
  try {
    const input = expenseSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }

    await createManualExpense({
      accountId: input.accountId,
      amountMinor,
      description: input.description,
      category: input.category,
    });

    try {
      const snap = await getTodaySnapshot();
      const pulse = calculateDayPulse({
        safeToSpendToday: money(snap.safeToSpendTodayMinor, snap.currency),
        spentToday: money(snap.todaySpendingMinor, snap.currency),
      });
      await recordOnTrackDayIfNeeded(pulse.status !== "minus");
    } catch {
      // Progress is best-effort; finance write already succeeded.
    }

    revalidatePath("/idag");
    revalidatePath("/transaktioner");
    revalidatePath("/analys");
    revalidatePath("/plan");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara utgift",
    };
  }
}

export async function createCheckpointAction(raw: {
  accountId: string;
  balance: string;
  source?: string;
}): Promise<ActionResult> {
  try {
    const accountId = z.string().uuid().parse(raw.accountId);
    const balanceMinor = parseUiAmountToMinor(raw.balance);
    if (balanceMinor < 0) {
      return { ok: false, error: "Saldo kan inte vara negativt" };
    }

    await createCheckpoint({
      accountId,
      balanceMinor,
      source: raw.source?.trim() || "manual_verification",
      note: "Manuellt verifierat saldo",
    });

    revalidatePath("/idag");
    revalidatePath("/konton");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara saldo",
    };
  }
}

export async function registerScreenshotImportAction(): Promise<ActionResult> {
  try {
    await createScreenshotObservation({
      institutionHint: null,
      notes:
        "Skärmbild markerad. För kvitton — använd Fota kvitto så systemet kan läsa beloppet.",
    });
    revalidatePath("/importera");
    revalidatePath("/mer");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte registrera import",
    };
  }
}
