"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import {
  setGettingStartedCollapsed,
  stampGettingStartedCompletedAt,
} from "@/lib/store/repository";

export type GettingStartedActionResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateGettingStarted() {
  revalidatePath("/idag");
  revalidatePath("/plan");
}

export async function collapseGettingStartedAction(): Promise<GettingStartedActionResult> {
  try {
    await setGettingStartedCollapsed(true);
    revalidateGettingStarted();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte minimera",
    };
  }
}

export async function expandGettingStartedAction(): Promise<GettingStartedActionResult> {
  try {
    await setGettingStartedCollapsed(false);
    revalidateGettingStarted();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte öppna",
    };
  }
}

export async function completeGettingStartedAction(): Promise<GettingStartedActionResult> {
  try {
    await stampGettingStartedCompletedAt();
    revalidateGettingStarted();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte stänga",
    };
  }
}
