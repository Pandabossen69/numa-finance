import { unstable_rethrow } from "next/navigation";
import {
  analysSnapshotFromToday,
  type AnalysSnapshot,
} from "@/features/finance/analys-from-known";
import { loadErrorMessageSv } from "@/lib/async";
import { reportError } from "@/lib/observe/report";
import { getTodaySnapshot } from "@/lib/store/repository";

/**
 * Analys actions are a fresh request — they cannot reuse Hem's React cache.
 * Use the 4s action budget, not Hem's 3s hang cap, so a slow-but-finishing
 * PostgREST read is not turned into «Kunde inte hämta analysen».
 */
export const ANALYS_SNAPSHOT_TIMEOUT_MS = 4_000;

export type {
  AnalysLedgerTx,
  AnalysLine,
  AnalysSnapshot,
} from "@/features/finance/analys-from-known";

export type AnalysSnapshotResult =
  | { ok: true; data: AnalysSnapshot }
  | { ok: false; error: string };

export async function loadAnalysSnapshot(): Promise<AnalysSnapshotResult> {
  try {
    const snap = await getTodaySnapshot({
      timeoutMs: ANALYS_SNAPSHOT_TIMEOUT_MS,
    });
    return { ok: true, data: analysSnapshotFromToday(snap) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[numa] loadAnalysSnapshot failed", error);
    void reportError("loader.analys", error);
    return {
      ok: false,
      error: loadErrorMessageSv(error, "Kunde inte hämta analysen"),
    };
  }
}
