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
  getProfile,
  listPlanItems,
  stampOnboardingCompletedAt,
  stampOnboardingSaldoAt,
  updatePlanItem,
  updateTransaction,
  voidTransaction,
} from "@/lib/store/repository";
import { reclaimStalePlanSettleLedgers } from "@/features/plan/sync-settle-ledger";
import type { CanonicalTransaction } from "@/domain/finance";
import { CURRENCIES, parseUiAmountToMinor, parseManualRate, type CurrencyCode } from "@/domain/money";
import {
  ACCOUNT_KINDS,
  assertCurrencyAllowedForKind,
  type AccountKind,
} from "@/domain/finance";

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
  kind: z.enum(ACCOUNT_KINDS),
  currency: z.enum(CURRENCIES),
  maskedIdentifier: z.string().trim().max(32).optional().nullable(),
  openingBalance: z.string().trim().min(1),
  /** Manual THB-per-1-unit rate when currency ≠ THB. Optional if Frankfurter works. */
  fxRate: z.string().trim().optional().nullable(),
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

    assertCurrencyAllowedForKind(input.kind as AccountKind, input.currency);

    const manualRate =
      input.currency === "THB"
        ? null
        : input.fxRate
          ? parseManualRate(input.fxRate)
          : null;
    if (input.currency !== "THB" && input.fxRate && manualRate == null) {
      return { ok: false, error: "Ogiltig växelkurs" };
    }

    const account = await createAccount({
      name: input.name,
      institution: input.institution,
      accountType: input.accountType,
      kind: input.kind,
      currency: input.currency,
      maskedIdentifier: input.maskedIdentifier,
      makeDefault: input.makeDefault ?? false,
    });

    await createCheckpoint({
      accountId: account.id,
      balanceMinor: openingMinor,
      source: "manual_opening_balance",
      note: "Ingående / verifierat saldo",
      fxRate: manualRate,
      fxSource: manualRate != null ? "manual" : null,
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

    const profile = await getProfile();
    await reclaimStalePlanSettleLedgers({
      timeZone: profile.timezone || "Asia/Bangkok",
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
 * same HTTP response. Desktop hard-locks; phone just feels slow. Tabs are
 * `force-dynamic`; the next visit is fresh. Hem / Rörelser / Konton already
 * patch themselves. Plan + Analys pick up the spend on the next tab open.
 */
function revalidateMoneyPaths() {
  revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");
}

async function reconcilePlanAfterLedgerTx(
  tx: CanonicalTransaction,
): Promise<void> {
  const profile = await getProfile();
  const timeZone = profile.timezone || "Asia/Bangkok";
  if (tx.planItemId) {
    const items = await listPlanItems();
    const item = items.find((row) => row.id === tx.planItemId);
    if (item) {
      if (tx.status === "voided") {
        await updatePlanItem({
          id: item.id,
          settledAt: null,
          settledMinor: null,
          remainingDueAt: item.nextDueAt,
        });
      } else {
        const minor = Math.min(item.amountMinor, Math.max(0, tx.amountMinor));
        const full = minor >= item.amountMinor;
        await updatePlanItem({
          id: item.id,
          settledAt: full ? new Date().toISOString() : null,
          settledMinor: minor,
          remainingDueAt: full
            ? null
            : (item.remainingDueAt ?? item.nextDueAt),
        });
      }
    }
  } else {
    await reclaimStalePlanSettleLedgers({ timeZone });
  }
  revalidateMoneyPaths();
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
    const tx = await updateTransaction({
      id,
      amountMinor,
      description: raw.description,
      category: raw.category,
    });
    await reconcilePlanAfterLedgerTx(tx);
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
    const tx = await voidTransaction(z.string().uuid().parse(id));
    await reconcilePlanAfterLedgerTx(tx);
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
    const profile = await getProfile();
    await reclaimStalePlanSettleLedgers({
      timeZone: profile.timezone || "Asia/Bangkok",
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
  fxRate?: string | null;
}): Promise<ActionResult & { thbMinor?: number }> {
  try {
    const accountId = z.string().uuid().parse(raw.accountId);
    const balanceMinor = parseUiAmountToMinor(raw.balance);
    if (balanceMinor < 0) {
      return { ok: false, error: "Saldo kan inte vara negativt" };
    }

    const manualRate = raw.fxRate ? parseManualRate(raw.fxRate) : null;
    if (raw.fxRate && manualRate == null) {
      return { ok: false, error: "Ogiltig växelkurs" };
    }

    const checkpoint = await createCheckpoint({
      accountId,
      balanceMinor,
      source: raw.source?.trim() || "manual_verification",
      note: "Manuellt verifierat saldo",
      fxRate: manualRate,
      fxSource: manualRate != null ? "manual" : null,
    });

    revalidateMoneyPaths();
    return { ok: true, thbMinor: checkpoint.thbMinor ?? undefined };
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
          kind: currency === "THB" ? "thai_bank" : "other",
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
