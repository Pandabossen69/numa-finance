"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  confirmBankMailCandidate,
  rejectBankMailCandidate,
} from "@/features/imports/bank-mail-confirm";
import type { ActionResult } from "@/features/imports/actions";
import { countPendingBankMail } from "@/features/imports/pending-bank-mail-count";
import { NUMA_MENU_SNAPSHOT_TAG } from "@/lib/supabase/cache-tags";
import { reportError } from "@/lib/observe/report";
import { refreshAfterDurableWrite } from "@/features/finance/mutation-refresh";

const schema = z.object({
  observationId: z.string().uuid(),
  clientMutationId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
});

const rejectSchema = z.object({
  observationId: z.string().uuid(),
});

/**
 * Same post-write bundle a Rörelser void returns: Hem, Plan, Konton and
 * Rörelser from one TodaySnapshot. The client adopts it with
 * adoptMutationFinance so keep-alive tabs do not keep the pre-confirm list.
 */
export async function refreshBankMailSurfacesAction() {
  // Tag only. revalidatePath on this action sets x-action-revalidated to
  // static+dynamic, wipes the prefetch cache, and the next SPA pushState
  // falls back to a full document load.
  const refreshed = await refreshAfterDurableWrite(() => {
    revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");
  });
  if (refreshed.refreshPending) return { ok: false as const };
  return { ok: true as const, ...refreshed.snapshots };
}

export async function pendingBankMailCountAction(): Promise<number> {
  return countPendingBankMail();
}

export async function confirmBankMailAction(
  raw: z.infer<typeof schema>,
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const input = schema.parse(raw);
    const tx = await confirmBankMailCandidate(input);
    return { ok: true, data: { transactionId: tx.id } };
  } catch (error) {
    void reportError("bank-mail.confirm", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte bekräfta mejlet",
    };
  }
}

export async function rejectBankMailAction(
  raw: z.infer<typeof rejectSchema>,
): Promise<ActionResult<{ observationId: string }>> {
  try {
    const input = rejectSchema.parse(raw);
    await rejectBankMailCandidate(input);
    return { ok: true, data: { observationId: input.observationId } };
  } catch (error) {
    void reportError("bank-mail.reject", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte avvisa mejlet",
    };
  }
}
