import {
  LOAD_TIMEOUT_MESSAGE_SV,
  loadErrorMessageSv,
} from "@/lib/async";
import type {
  AnalysSnapshot,
  AnalysSnapshotResult,
} from "@/features/finance/load-analys";

/** Client cap so reload never sits on «Hämtar analysen…» past ~5s. */
export const ANALYS_CLIENT_TIMEOUT_MS = 4_500;

/** One automatic retry after fail-soft — must not reset the 4.5s pending cap. */
export const ANALYS_AUTO_RETRY_BACKOFF_MS = 700;

let inflight: Promise<AnalysSnapshotResult> | null = null;
let lastResult: AnalysSnapshotResult | null = null;
let pendingStartedAt = 0;
let retryHandler: (() => void) | null = null;
let autoRetryUsed = false;

/** Last-known must have the fields the dashboard needs to leave pending. */
export function analysViewCanPaint(
  snap: AnalysSnapshot | null | undefined,
): boolean {
  return Boolean(snap?.month && snap.currentMonthKey);
}

export function lastAnalysFetchResult(): AnalysSnapshotResult | null {
  return lastResult;
}

export function analysClientFetchInflight(): boolean {
  return inflight != null;
}

export function canAnalysAutoRetry(): boolean {
  return !autoRetryUsed;
}

export function markAnalysAutoRetryUsed(): void {
  autoRetryUsed = true;
}

export function markAnalysPendingStarted(now = Date.now()): void {
  if (!pendingStartedAt) pendingStartedAt = now;
}

export function clearAnalysPendingClock(): void {
  pendingStartedAt = 0;
}

export function analysPendingHasExpired(now = Date.now()): boolean {
  return pendingStartedAt > 0 && now - pendingStartedAt >= ANALYS_CLIENT_TIMEOUT_MS;
}

export function analysPendingRemainingMs(now = Date.now()): number {
  if (!pendingStartedAt) return ANALYS_CLIENT_TIMEOUT_MS;
  return Math.max(0, ANALYS_CLIENT_TIMEOUT_MS - (now - pendingStartedAt));
}

export function registerAnalysClientRetry(handler: () => void): () => void {
  retryHandler = handler;
  return () => {
    if (retryHandler === handler) retryHandler = null;
  };
}

/** Drop a prior fail-soft so the next mount/tap can fetch again. */
export function resetAnalysClientFetch(): void {
  lastResult = null;
  inflight = null;
  pendingStartedAt = 0;
}

export function requestAnalysClientRetry(): void {
  const handler = retryHandler;
  resetAnalysClientFetch();
  autoRetryUsed = false;
  handler?.();
}

/** Test helper — reset module state between unit cases. */
export function resetAnalysClientFetchForTests(): void {
  resetAnalysClientFetch();
  retryHandler = null;
  autoRetryUsed = false;
}

/**
 * Fetch Analys with a hard client timeout that does not Promise.race the
 * server-action thenable. Next.js production dispatches actions inside
 * startTransition and the Flight POST (plus RSC re-render from the root)
 * can remount the route before `withTimeout` settles — preview still
 * fail-softs because the action body returns. The timer below is the UI cap.
 */
export function fetchAnalysSnapshotClient(
  load: () => Promise<AnalysSnapshotResult>,
  timeoutMs = ANALYS_CLIENT_TIMEOUT_MS,
): Promise<AnalysSnapshotResult> {
  markAnalysPendingStarted();
  if (inflight) return inflight;
  inflight = settleAnalysFetch(load, timeoutMs).finally(() => {
    inflight = null;
  });
  return inflight;
}

function settleAnalysFetch(
  load: () => Promise<AnalysSnapshotResult>,
  timeoutMs: number,
): Promise<AnalysSnapshotResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: AnalysSnapshotResult) => {
      if (settled) return;
      settled = true;
      lastResult = result;
      if (result.ok) clearAnalysPendingClock();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: LOAD_TIMEOUT_MESSAGE_SV,
      });
    }, timeoutMs);

    void Promise.resolve()
      .then(() => load())
      .then((result) => {
        clearTimeout(timer);
        finish(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        finish({
          ok: false,
          error: loadErrorMessageSv(error, LOAD_TIMEOUT_MESSAGE_SV),
        });
      });
  });
}
