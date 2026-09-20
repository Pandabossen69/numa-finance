import { unstable_rethrow } from "next/navigation";
import {
  analysSnapshotFromToday,
  type AnalysSnapshot,
} from "@/features/finance/analys-from-known";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import { loadErrorMessageSv } from "@/lib/async";
import { reportError } from "@/lib/observe/report";

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
    const snap = await getCachedTodaySnapshot();
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
