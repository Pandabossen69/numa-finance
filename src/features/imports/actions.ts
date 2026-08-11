"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseUiAmountToMinor, money } from "@/domain/money";
import { calculateDayPulse } from "@/domain/gamification";
import { projectLivingBudget, projectPayCycle } from "@/domain/finance";
import {
  confirmReceiptExpense,
  getTodaySnapshot,
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

    const preferBankSms =
      formData.get("mode") === "bank_sms" || formData.get("mode") === "sms";

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadReceiptAndExtract({
      fileName: file.name || "bank-sms.jpg",
      mimeType,
      bytes,
      preferBankSms,
    });

    revalidatePath("/importera");
    revalidatePath("/mer");
    revalidatePath("/fota");
    revalidatePath("/idag");
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte ladda upp bilden",
    };
  }
}

const confirmSchema = z.object({
  accountId: z.string().uuid().optional().nullable(),
  observationId: z.string().uuid(),
  candidateId: z.string().uuid().optional().nullable(),
  confirmAllPending: z.boolean().optional(),
  amount: z.string().trim().optional().default("0"),
  description: z.string().trim().max(160).optional(),
  category: z.string().trim().max(40).optional().nullable(),
  fingerprint: z.string().trim().max(240).optional().nullable(),
  balanceAfterMinor: z.number().int().optional().nullable(),
  source: z.enum(["receipt_camera", "screenshot"]).optional(),
  maskedAccount: z.string().trim().max(32).optional().nullable(),
  direction: z.enum(["debit", "credit"]).optional().nullable(),
});

export async function confirmReceiptExpenseAction(
  raw: z.infer<typeof confirmSchema>,
): Promise<
  ActionResult<{
    pulseStatus: "plus" | "even" | "minus";
    balanceAfterMinor: number | null;
    direction: "debit" | "credit" | null;
    amountMinor: number;
  }>
> {
  try {
    const input = confirmSchema.parse(raw);
    const isSmsBatch =
      input.confirmAllPending === true || input.source === "screenshot";

    let amountMinor = 0;
    if (!isSmsBatch) {
      amountMinor = parseUiAmountToMinor(input.amount || "0");
      if (amountMinor <= 0) {
        return { ok: false, error: "Ange ett belopp större än noll" };
      }
    }

    const tx = await confirmReceiptExpense({
      accountId: input.accountId,
      observationId: input.observationId,
      candidateId: input.candidateId,
      confirmAllPending: isSmsBatch,
      amountMinor: amountMinor || 1,
      description: input.description,
      category: input.category,
      fingerprint: input.fingerprint,
      balanceAfterMinor: input.balanceAfterMinor,
      source: input.source,
      maskedAccount: input.maskedAccount,
      direction: input.direction,
    });

    const snap = await getTodaySnapshot();
    const timeZone = snap.profile.timezone || "Asia/Bangkok";
    const now = new Date();
    const cycle = projectPayCycle(snap.planItems ?? [], now, timeZone);
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone,
      bankBalanceMinor: snap.calculatedBalanceMinor,
      cycleSpendingMinor: snap.cycleSpendingMinor ?? 0,
    });
    const pulse = calculateDayPulse({
      safeToSpendToday: money(living.perDayMinor, snap.currency),
      spentToday: money(snap.todaySpendingMinor, snap.currency),
    });

    revalidatePath("/idag");
    revalidatePath("/transaktioner");
    revalidatePath("/analys");
    revalidatePath("/plan");
    revalidatePath("/importera");
    revalidatePath("/mer");
    revalidatePath("/konton");
    revalidatePath("/fota");

    return {
      ok: true,
      data: {
        pulseStatus: pulse.status,
        balanceAfterMinor:
          snap.calculatedBalanceMinor ?? tx.balanceAfterMinor ?? null,
        direction: tx.direction,
        amountMinor: tx.amountMinor,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte bekräfta köpet",
    };
  }
}
