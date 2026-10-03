import { isPendingBankMail } from "@/features/imports/bank-mail-queue";
import { listObservations } from "@/lib/store/repository";

/** Pending bank-mail rows for the signed-in user. Fail-soft to 0. */
export async function countPendingBankMail(): Promise<number> {
  try {
    const rows = await listObservations();
    return rows.filter((row) => isPendingBankMail(row)).length;
  } catch {
    return 0;
  }
}
