"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { parseUiAmountToMinor, money } from "@/domain/money";
import { ALLOWED_IMAGE_MIME, assertAllowedImageBytes } from "@/lib/media/image-magic";
import { reportError } from "@/lib/observe/report";
import { calculateDayPulse } from "@/domain/gamification";
import { projectLivingBudget, projectPayCycle } from "@/domain/finance";
import {
  confirmReceiptExpense,
  getProfile,
  getTodaySnapshot,
  stampOnboardingCompletedAt,
  stampOnboardingSaldoAt,
  uploadReceiptAndExtract,
  type ReceiptUploadResult,
} from "@/lib/store/repository";
import { reclaimStalePlanSettleLedgers } from "@/features/plan/sync-settle-ledger";
import {
  isUniqueViolationMessage,
  swedishFingerprintConflictError,
} from "@/domain/finance";
import { NUMA_MENU_SNAPSHOT_TAG } from "@/lib/supabase/cache-tags";
import { SAVED_REFRESH_PENDING_SV } from "@/features/finance/mutation-refresh";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; refreshPending?: boolean; refreshPendingMessage?: string }
  | { ok: false; error: string };

const MAX_BYTES = 8 * 1024 * 1024;

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
    const claimed = file.type || "image/jpeg";
    if (!ALLOWED_IMAGE_MIME.has(claimed) && !claimed.startsWith("image/")) {
      return { ok: false, error: "Endast bildfiler stöds" };
    }

    const mode = String(formData.get("mode") ?? "");
    const preferBankSms = mode === "bank_sms" || mode === "sms";
    const preferBankApp =
      mode === "bank_app" || mode === "bunq" || mode === "revolut";

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = assertAllowedImageBytes(bytes, claimed);
    const result = await uploadReceiptAndExtract({
      fileName: file.name || (preferBankApp ? "bank-app.jpg" : "bank-sms.jpg"),
      mimeType,
      bytes,
      preferBankSms,
      preferBankApp,
    });

    revalidatePath("/importera");
    revalidatePath("/mer");
    revalidatePath("/fota");
    revalidatePath("/idag");
    return { ok: true, data: result };
  } catch (error) {
    void reportError("ocr.upload", error);
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
  source: z.enum(["receipt_camera", "screenshot", "bank_import"]).optional(),
  maskedAccount: z.string().trim().max(32).optional().nullable(),
  direction: z.enum(["debit", "credit"]).optional().nullable(),
  fromOnboarding: z.boolean().optional(),
  clientMutationId: z.string().uuid().optional(),
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
      input.confirmAllPending === true ||
      input.source === "screenshot" ||
      input.source === "bank_import";

    let amountMinor: number | undefined;
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
      amountMinor,
      description: input.description,
      category: input.category,
      fingerprint: input.fingerprint,
      balanceAfterMinor: input.balanceAfterMinor,
      source: input.source,
      maskedAccount: input.maskedAccount,
      direction: input.direction,
      clientMutationId: input.clientMutationId,
    });

    if (input.fromOnboarding) {
      await stampOnboardingSaldoAt();
      await stampOnboardingCompletedAt();
    }

    const profile = await getProfile();
    await reclaimStalePlanSettleLedgers({
      timeZone: profile.timezone || "Asia/Bangkok",
    });
    try {
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
        todaySpendingMinor: snap.todaySpendingMinor,
        fundingConfirmed: snap.fundingConfirmed,
      });
      const pulse = calculateDayPulse({
        safeToSpendToday: money(living.dayBudgetMinor, snap.currency),
        spentToday: money(snap.todaySpendingMinor, snap.currency),
      });

      revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");

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
    } catch {
      revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max");
      return {
        ok: true,
        refreshPending: true,
        refreshPendingMessage: SAVED_REFRESH_PENDING_SV,
        data: {
          pulseStatus: "even",
          balanceAfterMinor: tx.balanceAfterMinor ?? null,
          direction: tx.direction,
          amountMinor: tx.amountMinor,
        },
      };
    }
  } catch (error) {
    void reportError("ocr.confirm", error);
    const message = error instanceof Error ? error.message : "";
    if (isUniqueViolationMessage(message)) {
      return { ok: false, error: swedishFingerprintConflictError() };
    }
    return {
      ok: false,
      error: message || "Kunde inte bekräfta köpet",
    };
  }
}

export async function deleteObservationAction(
  observationId: string,
): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(observationId);
    const { deleteObservation } = await import("@/lib/store/repository");
    await deleteObservation(id);
    revalidatePath("/fota");
    revalidatePath("/importera");
    return { ok: true, data: undefined };
  } catch (error) {
    void reportError("ocr.upload", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte radera bilden",
    };
  }
}
