"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { confirmBankMailCandidate } from "@/features/imports/bank-mail-confirm";
import { isPendingBankMail } from "@/features/imports/bank-mail-queue";
import type { ActionResult } from "@/features/imports/actions";
import { listObservations } from "@/lib/store/repository";
import { NUMA_MENU_SNAPSHOT_TAG } from "@/lib/supabase/cache-tags";
import { reportError } from "@/lib/observe/report";

const schema = z.object({
  observationId: z.string().uuid(),
  clientMutationId: z.string().uuid().optional(),
});

export async function pendingBankMailCountAction(): Promise<number> {
  try {
    const rows = await listObservations();
    return rows.filter((row) => isPendingBankMail(row)).length;
  } catch {
    return 0;
  }
}

export async function confirmBankMailAction(
  raw: z.infer<typeof schema>,
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const input = schema.parse(raw);
    const tx = await confirmBankMailCandidate(input);
    revalidatePath("/idag");
    revalidatePath("/transaktioner");
    revalidatePath("/importera");
    revalidatePath("/fota");
    revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");
    return { ok: true, data: { transactionId: tx.id } };
  } catch (error) {
    void reportError("bank-mail.confirm", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte bekräfta mejlet",
    };
  }
}
