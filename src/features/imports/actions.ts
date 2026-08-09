"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseUiAmountToMinor } from "@/domain/money";
import { calculateDayPulse } from "@/domain/gamification";
import { money } from "@/domain/money";
import {
  confirmReceiptExpense,
  getTodaySnapshot,
  recordOnTrackDayIfNeeded,
  uploadReceiptAndExtract,
  type ReceiptUploadResult,
} from "@/lib/store/repository";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function uploadReceiptAction(
  formData: FormData,
): Promise<ActionResult<ReceiptUploadResult>> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Välj en bild först" };
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return { ok: false, error: "Bilden måste vara mellan 1 byte och 8 MB" };
    }
    const mimeType = file.type || "image/jpeg";
    if (!ALLOWED.has(mimeType) && !mimeType.startsWith("image/")) {
      return { ok: false, error: "Endast bildfiler stöds" };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadReceiptAndExtract({
      fileName: file.name || "kvitto.jpg",
      mimeType,
      bytes,
    });

    revalidatePath("/importera");
    revalidatePath("/mer");
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte ladda upp kvittot",
    };
  }
}

const confirmSchema = z.object({
  accountId: z.string().uuid(),
  observationId: z.string().uuid(),
  candidateId: z.string().uuid().optional().nullable(),
  amount: z.string().trim().min(1),
  description: z.string().trim().max(120).optional(),
  category: z.string().trim().max(40).optional().nullable(),
});

export async function confirmReceiptExpenseAction(
  raw: z.infer<typeof confirmSchema>,
): Promise<ActionResult<{ pulseStatus: "plus" | "even" | "minus" }>> {
  try {
    const input = confirmSchema.parse(raw);
    const amountMinor = parseUiAmountToMinor(input.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Ange ett belopp större än noll" };
    }

    await confirmReceiptExpense({
      accountId: input.accountId,
      observationId: input.observationId,
      candidateId: input.candidateId,
      amountMinor,
      description: input.description,
      category: input.category,
    });

    const snap = await getTodaySnapshot();
    const pulse = calculateDayPulse({
      safeToSpendToday: money(snap.safeToSpendTodayMinor, snap.currency),
      spentToday: money(snap.todaySpendingMinor, snap.currency),
    });
    await recordOnTrackDayIfNeeded(pulse.status !== "minus");

    revalidatePath("/idag");
    revalidatePath("/transaktioner");
    revalidatePath("/analys");
    revalidatePath("/plan");
    revalidatePath("/importera");
    revalidatePath("/mer");

    return { ok: true, data: { pulseStatus: pulse.status } };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte bekräfta köpet",
    };
  }
}
