import { getTodaySnapshotCached } from "@/lib/store/today";
import type { TodaySnapshot } from "@/lib/store/types-snapshot";

export type SafeSnapshotResult =
  | { ok: true; snap: TodaySnapshot }
  | { ok: false; error: unknown };

export async function safeLoadTodaySnapshot(): Promise<SafeSnapshotResult> {
  try {
    const snap = await getTodaySnapshotCached();
    return { ok: true, snap };
  } catch (error) {
    console.error("[numa] snapshot failed", error);
    return { ok: false, error };
  }
}
