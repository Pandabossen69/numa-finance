"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createAccount,
  createCashWithdrawal,
  createCheckpoint,
  createManualExpense,
  createManualIncome,
  createScreenshotObservation,
  createTransfer,
  getTodaySnapshot,
  recordOnTrackDayIfNeeded,
  updateManualTransaction,
  voidTransaction,
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

const whenSchema = z.enum(["today", "yesterday"]).optional();

const expenseSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.string().trim().min(1),
  description: z.string().trim().min(1).max(120),
  category: z.string().trim().max(40).optional().nullable(),
  when: whenSchema,
});

function occurredAtFromWhen(when?: "today" | "yesterday"): string | undefined {
  if (!when || when === "today") return undefined;
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

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
      occurredAt: occurredAtFromWhen(input.when),
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

const incomeSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.string().trim().min(1),
  description: z.string().trim().min(1).max(120),
  when: whenSchema,
});

const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.string().trim().min(1),
  description: z.string().trim().max(120).optional(),
  when: whenSchema,
});

const cashSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid().optional().nullable(),
  amount: z.string().trim().min(1),
  description: z.string().trim().max(120).optional(),
  when: whenSchema,
});

function revalidateMoneyPaths() {
  revalidatePath("/idag");
  revalidatePath("/transaktioner");
  revalidatePath("/analys");
  revalidatePath("/plan");
  revalidatePath("/konton");
}

export async function createIncomeAction(
  raw: z.infer<typeof incomeSchema>,
): Promise<ActionResult> {
  try {
    const input = incomeSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }
    await createManualIncome({
      accountId: input.accountId,
      amountMinor,
      description: input.description,
      occurredAt: occurredAtFromWhen(input.when),
    });
    revalidateMoneyPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara inkomst",
    };
  }
}

export async function createTransferAction(
  raw: z.infer<typeof transferSchema>,
): Promise<ActionResult> {
  try {
    const input = transferSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }
    await createTransfer({
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountMinor,
      description: input.description,
      occurredAt: occurredAtFromWhen(input.when),
    });
    revalidateMoneyPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte spara överföring",
    };
  }
}

export async function createCashWithdrawalAction(
  raw: z.infer<typeof cashSchema>,
): Promise<ActionResult> {
  try {
    const input = cashSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }
    await createCashWithdrawal({
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountMinor,
      description: input.description,
      occurredAt: occurredAtFromWhen(input.when),
    });
    revalidateMoneyPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte spara kontantuttag",
    };
  }
}

export async function voidTransactionAction(
  id: string,
): Promise<ActionResult> {
  try {
    await voidTransaction(z.string().uuid().parse(id));
    revalidateMoneyPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte ta bort rörelsen",
    };
  }
}

export async function updateTransactionAction(raw: {
  id: string;
  description: string;
  category?: string | null;
  amount: string;
}): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(raw.id);
    const description = z.string().trim().min(1).max(120).parse(raw.description);
    const category =
      raw.category == null
        ? undefined
        : z.string().trim().max(40).nullable().parse(raw.category);
    const amountMinor = parseUiAmountToMinor(raw.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }
    await updateManualTransaction({
      id,
      description,
      category,
      amountMinor,
    });
    revalidateMoneyPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte uppdatera rörelsen",
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
