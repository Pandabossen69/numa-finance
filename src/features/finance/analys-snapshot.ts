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

/** Client refresh / quiet warm — RSC pages call `loadAnalysSnapshot` directly. */
export async function getAnalysSnapshotAction(): Promise<AnalysSnapshotResult> {
  try {
    return await withTimeout(
      loadAnalysSnapshot(),
      ANALYS_ACTION_TIMEOUT_MS,
      "analysSnapshot",
    );
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error: loadErrorMessageSv(error, LOAD_TIMEOUT_MESSAGE_SV),
    };
  }
}
