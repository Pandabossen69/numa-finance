"use server";

import {
  loadAnalysSnapshot,
  type AnalysSnapshotResult,
} from "@/features/finance/load-analys";

export type { AnalysSnapshot, AnalysSnapshotResult } from "@/features/finance/load-analys";

/** Client refresh / quiet warm — RSC pages call `loadAnalysSnapshot` directly. */
export async function getAnalysSnapshotAction(): Promise<AnalysSnapshotResult> {
  return loadAnalysSnapshot();
}
