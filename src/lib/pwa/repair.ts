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

export async function clearNumaRuntimeCache(): Promise<void> {
  try {
    localStorage.removeItem(NUMA_SW_KILL_FLAG);
    sessionStorage.removeItem("numa.blankGuard.v1");
  } catch {
    // ignore
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
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
