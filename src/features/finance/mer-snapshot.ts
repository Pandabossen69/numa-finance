"use server";

import { chromeDisplayName } from "@/domain/identity/display-name";
import type { MerSnapshot } from "@/features/home/last-snapshot";
import { currentUserIsNumaAdmin } from "@/features/auth/session";
import { withTimeout } from "@/lib/async";
import { getProfile } from "@/lib/store/repository";

const MER_TIMEOUT_MS = 3_000;

export type MerSnapshotResult =
  | { ok: true; data: MerSnapshot }
  | { ok: false; error: string };

/** Quiet Mer refresh for client-first / SPA keep-alive. */
export async function getMerSnapshotAction(): Promise<MerSnapshotResult> {
  try {
    const [profile, isAdmin] = await Promise.all([
      withTimeout(getProfile(), MER_TIMEOUT_MS, "merProfile"),
      withTimeout(currentUserIsNumaAdmin(), MER_TIMEOUT_MS, "merAdmin").catch(
        () => false,
      ),
    ]);
    if (!profile) {
      return { ok: false, error: "Kunde inte läsa profilen." };
    }
    return {
      ok: true,
      data: {
        userId: profile.id,
        displayName: chromeDisplayName(profile.displayName),
        isAdmin,
      },
    };
  } catch (error) {
    console.error("[numa] getMerSnapshotAction failed", error);
    return { ok: false, error: "Kunde inte ladda Mer." };
  }
}
