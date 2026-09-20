"use server";

import { unstable_rethrow } from "next/navigation";
import {
  loadAnalysSnapshot,
  type AnalysSnapshotResult,
} from "@/features/finance/load-analys";
import { LOAD_TIMEOUT_MESSAGE_SV, loadErrorMessageSv, withTimeout } from "@/lib/async";

export type { AnalysSnapshot, AnalysSnapshotResult } from "@/features/finance/load-analys";

/** Slightly under the client cap so a hung action still returns. */
const ANALYS_ACTION_TIMEOUT_MS = 4_000;

/** Visible-tab refresh / fail-soft — quiet warm derives Analys from Plan. */
export async function getAnalysSnapshotAction(): Promise<AnalysSnapshotResult> {
  const started = Date.now();
  try {
    const result = await withTimeout(
      loadAnalysSnapshot(),
      ANALYS_ACTION_TIMEOUT_MS,
      "analysSnapshot",
    );
    console.info("[numa] analysSnapshot", {
      ms: Date.now() - started,
      ok: result.ok,
    });
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.info("[numa] analysSnapshot", {
      ms: Date.now() - started,
      ok: false,
    });
    return {
      ok: false,
      error: loadErrorMessageSv(error, LOAD_TIMEOUT_MESSAGE_SV),
    };
  }
}
