"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import {
  stampOnboardingCompletedAt,
} from "@/lib/store/repository";
import { persistOnboardingPhaseCookie } from "./persist-cookie";

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    await stampOnboardingCompletedAt();
    await persistOnboardingPhaseCookie("done");
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
