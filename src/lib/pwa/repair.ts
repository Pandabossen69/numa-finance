export const NUMA_SW_KILL_FLAG = "numa.swKill.v8";

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

/**
 * Refresh the installed app shell without tearing down the controller mid-nav.
 *
 * Important (iOS home-screen): unregistering the service worker and then
 * immediately calling location.replace("/idag") often surfaces Safari's
 * "This page couldn't load" interstitial in standalone mode. We instead:
 * 1. wipe Cache Storage
 * 2. ask the existing worker to update + skipWaiting
 * 3. let the caller navigate with {@link navigateAfterRepair}
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

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        try {
          await reg.update();
        } catch {
          // ignore network/update failures — cache wipe still helps
        }
        reg.waiting?.postMessage({ type: "SKIP_WAITING" });
      }),
    );
  }

  try {
    localStorage.setItem(NUMA_SW_KILL_FLAG, "done");
  } catch {
    // ignore
  }
}

/**
 * Same-origin hard navigation that survives iOS standalone after a repair.
 * Uses absolute URL + assign (not replace) after a short settle delay.
 */
export function navigateAfterRepair(path = "/idag"): void {
  if (typeof window === "undefined") return;
  const url = new URL(path, window.location.origin);
  url.searchParams.set("r", String(Date.now()));
  window.setTimeout(() => {
    window.location.assign(url.href);
  }, 250);
}
