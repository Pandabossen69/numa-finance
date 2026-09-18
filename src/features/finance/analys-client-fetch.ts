import {
  LOAD_TIMEOUT_MESSAGE_SV,
  loadErrorMessageSv,
  withTimeout,
} from "@/lib/async";
import type { AnalysSnapshotResult } from "@/features/finance/load-analys";

/** Client cap so reload never sits on «Hämtar analysen…» past ~5s. */
export const ANALYS_CLIENT_TIMEOUT_MS = 4_500;

/**
 * Fetch Analys with a hard client timeout. Server-action transport can hang
 * after the snapshot timer; the UI must still fail-soft in Swedish.
 */
export async function fetchAnalysSnapshotClient(
  load: () => Promise<AnalysSnapshotResult>,
  timeoutMs = ANALYS_CLIENT_TIMEOUT_MS,
): Promise<AnalysSnapshotResult> {
  try {
    return await withTimeout(load(), timeoutMs, "analysSnapshot");
  } catch (error) {
    return {
      ok: false,
      error: loadErrorMessageSv(error, LOAD_TIMEOUT_MESSAGE_SV),
    };
  }
}
