"use server";

import { revalidateTag } from "next/cache";
import { NUMA_MENU_SNAPSHOT_TAG } from "@/lib/supabase/cache-tags";
import { z } from "zod";
import {
  createAccount,
  createCashWithdrawal,
  createCheckpoint,
  createManualExpense,
  createManualIncome,
  createTransfer,
  ensureDefaultBankAccount,
  stampOnboardingCompletedAt,
  stampOnboardingSaldoAt,
  updateTransaction,
  voidTransaction,
} from "@/lib/store/repository";
import { CURRENCIES, parseUiAmountToMinor, type CurrencyCode } from "@/domain/money";

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
  currency: z.enum(CURRENCIES),
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
  | { ok: true; id?: string }
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
      makeDefault: input.makeDefault ?? false,
    });

    await createCheckpoint({
      accountId: account.id,
      balanceMinor: openingMinor,
      source: "manual_opening_balance",
      note: "Ingående / verifierat saldo",
    });

    revalidateMoneyPaths();
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

    const tx = await createManualExpense({
      accountId: input.accountId,
      amountMinor,
      description: input.description,
      category: input.category,
    });

    revalidateMoneyPaths();
    return { ok: true, id: tx.id };
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
  description: z.string().trim().max(120).optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.string().trim().min(1),
  description: z.string().trim().max(120).optional(),
});

const cashSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.string().trim().min(1),
  description: z.string().trim().max(120).optional(),
});

/**
 * Mark money data stale without re-rendering the current route.
 *
 * `revalidatePath` on a Server Action ships a full RSC Flight payload in the
 * same HTTP response. The client commits that as a seeded navigation and the
 * main thread freezes — desktop hard-locks, phone just feels slow. Tabs are
 * `force-dynamic`; the next visit is fresh. Hem / Rörelser already patch
 * themselves from the write.
 *
 * `revalidateTag(..., "max")` is SWR-only and does not include a re-render.
 */
function revalidateMoneyPaths() {
  revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");
}

export async function updateTransactionAction(raw: {
  id: string;
  amount: string;
  description?: string;
  category?: string | null;
}): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(raw.id);
    const amountMinor = parseUiAmountToMinor(raw.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }
    await updateTransaction({
      id,
      amountMinor,
      description: raw.description,
      category: raw.category,
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

export async function voidTransactionAction(id: string): Promise<ActionResult> {
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

export async function createIncomeAction(
  raw: z.infer<typeof incomeSchema>,
): Promise<ActionResult> {
  try {
    const input = incomeSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }
    const tx = await createManualIncome({
      accountId: input.accountId,
      amountMinor,
      description: input.description,
    });
    revalidateMoneyPaths();
    return { ok: true, id: tx.id };
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

    revalidateMoneyPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara saldo",
    };
  }
}

/** First-month / bridge: set how much is left on the account until next income. */
export async function setAvailableNowAction(raw: {
  balance: string;
  accountId?: string | null;
  currency?: CurrencyCode;
  accountName?: string | null;
  fromOnboarding?: boolean;
}): Promise<ActionResult> {
  try {
    const balanceMinor = parseUiAmountToMinor(raw.balance);
    if (balanceMinor < 0) {
      return { ok: false, error: "Belopp kan inte vara negativt" };
    }

    let accountId = raw.accountId?.trim() || null;
    if (accountId) {
      z.string().uuid().parse(accountId);
    } else {
      const currency = raw.currency ?? "THB";
      const accountName = raw.accountName?.trim() || null;
      if (accountName) {
        const account = await createAccount({
          name: accountName.slice(0, 80),
          accountType: "checking",
          currency,
          makeDefault: true,
        });
        accountId = account.id;
      } else {
        const account = await ensureDefaultBankAccount({ currency });
        accountId = account.id;
      }
    }

    await createCheckpoint({
      accountId,
      balanceMinor,
      source: "manual_available_now",
      note: "Tillgängligt tills nästa intäkt",
    });

    if (raw.fromOnboarding) {
      await stampOnboardingSaldoAt();
      await stampOnboardingCompletedAt();
    }

    revalidateMoneyPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte spara tillgängligt belopp",
    };
  }
}
