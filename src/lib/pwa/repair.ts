export const NUMA_SW_KILL_FLAG = "numa.swKill.v8";
export const NUMA_REPAIR_DONE_PARAM = "updated";

export type LagaPhase = "idle" | "confirm" | "running" | "done" | "error";
export type LagaEvent = "ask" | "cancel" | "success" | "fail";

/** Pure state machine — /laga never starts in running. */
export function nextLagaPhase(phase: LagaPhase, event: LagaEvent): LagaPhase {
  switch (event) {
    case "ask":
      return phase === "idle" || phase === "error" ? "confirm" : phase;
    case "cancel":
      return phase === "confirm" ? "idle" : phase;
    case "success":
      return phase === "running" ? "done" : phase;
    case "fail":
      return phase === "running" ? "error" : phase;
    default:
      return phase;
  }
}

export function lagaStartsIdle(): boolean {
  return true;
}

export function isRepairDoneSearch(search: string): boolean {
  try {
    return new URLSearchParams(search).get(NUMA_REPAIR_DONE_PARAM) === "1";
  } catch {
    return false;
  }
}

/**
 * Wipe Cache Storage + local repair flags.
 *
 * Do NOT call registration.update() or post skip-waiting here. In standalone iOS,
 * that fires PwaRegister's controllerchange → location.reload() in the same
 * turn as our navigation and surfaces "This page couldn't load".
 * Cache wipe + a calm same-document reload is enough; PwaRegister still
 * picks up new /sw.js on the next focus/pageshow.
 */
export async function clearNumaRuntimeCache(): Promise<void> {
  try {
    localStorage.removeItem(NUMA_SW_KILL_FLAG);
    sessionStorage.removeItem("numa.blankGuard.v1");
  } catch {
    // ignore
  }

  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  try {
    localStorage.setItem(NUMA_SW_KILL_FLAG, "done");
  } catch {
    // ignore
  }
}

/**
 * After a successful repair: reload /laga with ?updated=1.
 * Same-document navigation is the only reliably safe hop on iOS standalone
 * right after cache churn. The success screen then offers a normal <a> to Hem.
 */
export function reloadRepairSuccessPage(): void {
  if (typeof window === "undefined") return;
  const url = new URL("/laga", window.location.origin);
  url.searchParams.set(NUMA_REPAIR_DONE_PARAM, "1");
  window.location.assign(url.href);
}
