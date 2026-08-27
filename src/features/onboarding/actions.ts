"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import {
  stampOnboardingCompletedAt,
} from "@/lib/store/repository";

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    await stampOnboardingCompletedAt();
    revalidatePath("/", "layout");
    revalidatePath("/idag");
    revalidatePath("/kom-igang");
    revalidatePath("/kom-igang/plan");
    revalidatePath("/plan");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte avsluta introduktionen",
    };
  }
}
