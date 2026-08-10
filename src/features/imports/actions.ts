"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseUiAmountToMinor } from "@/domain/money";
import { calculateDayPulse } from "@/domain/gamification";
import { money } from "@/domain/money";
import {
  confirmBankSmsImport,
  confirmReceiptExpense,
  getTodaySnapshot,
  parseBankSmsText,
  uploadBankSmsAndExtract,
  uploadReceiptAndExtract,
  type BankSmsUploadResult,
  type ConfirmBankSmsResult,
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
      plannedToday: money(snap.dayPlanMinor, snap.currency),
      spentToday: money(snap.todaySpendingMinor, snap.currency),
    });
    // Mid-day pulse is feedback only — streak is awarded via closeDayAction.

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

export async function uploadBankSmsAction(
  formData: FormData,
): Promise<ActionResult<BankSmsUploadResult>> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Välj en skärmbild först" };
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return { ok: false, error: "Bilden måste vara mellan 1 byte och 8 MB" };
    }
    const mimeType = file.type || "image/jpeg";
    if (!ALLOWED.has(mimeType) && !mimeType.startsWith("image/")) {
      return { ok: false, error: "Endast bildfiler stöds" };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadBankSmsAndExtract({
      fileName: file.name || "bank-sms.jpg",
      mimeType,
      bytes,
    });

    revalidatePath("/importera");
    revalidatePath("/bank-sms");
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte läsa bank-SMS-bilden",
    };
  }
}

const pasteSchema = z.object({
  text: z.string().trim().min(10).max(20000),
});

export async function parseBankSmsTextAction(
  raw: z.infer<typeof pasteSchema>,
): Promise<ActionResult<BankSmsUploadResult>> {
  try {
    const input = pasteSchema.parse(raw);
    const result = await parseBankSmsText({ text: input.text });
    revalidatePath("/importera");
    revalidatePath("/bank-sms");
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte tolka SMS-texten",
    };
  }
}

const confirmBankSchema = z.object({
  accountId: z.string().uuid(),
  observationId: z.string().uuid(),
  updateCheckpoint: z.boolean().optional(),
  items: z
    .array(
      z.object({
        fingerprint: z.string().min(8).max(400),
        direction: z.enum(["debit", "credit"]),
        amountMinor: z.number().int().positive(),
        balanceAfterMinor: z.number().int().nullable(),
        description: z.string().trim().min(1).max(120),
        skip: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(40),
});

export async function confirmBankSmsImportAction(
  raw: z.infer<typeof confirmBankSchema>,
): Promise<ActionResult<ConfirmBankSmsResult>> {
  try {
    const input = confirmBankSchema.parse(raw);
    const result = await confirmBankSmsImport(input);

    revalidatePath("/idag");
    revalidatePath("/transaktioner");
    revalidatePath("/analys");
    revalidatePath("/plan");
    revalidatePath("/importera");
    revalidatePath("/bank-sms");
    revalidatePath("/mer");

    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte spara bank-SMS-importen",
    };
  }
}
