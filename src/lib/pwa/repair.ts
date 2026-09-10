export const NUMA_SW_KILL_FLAG = "numa.swKill.v8";
/** Suppresses PwaRegister's standalone auto-reload during/after repair. */
export const NUMA_REPAIR_QUIET_FLAG = "numa.repairQuiet.v1";
/** Long enough for /laga → Hem navigation; not a retry loop. */
export const REPAIR_QUIET_MS = 20_000;

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
 * Primitive snapshot for useSyncExternalStore.
 * Returning a new object each call caused max-update-depth on /laga.
 */
export function readLagaHostSnapshot(
  hostname: string,
  frozen: boolean,
): string | null {
  return frozen ? hostname : null;
}

/** Repeated "Uppdatera nu" must not start a second repair. */
export function shouldAcceptRepairStart(alreadyStarted: boolean): boolean {
  return !alreadyStarted;
}

/**
 * Standalone PWA auto-reload after a new worker takes control.
 * Must stay false during repair so /laga is not reloaded instead of Hem.
 */
export function shouldReloadOnControllerChange(input: {
  hadController: boolean;
  standalone: boolean;
  repairQuiet: boolean;
}): boolean {
  return input.hadController && input.standalone && !input.repairQuiet;
}

export function beginRepairQuietWindow(now = Date.now()): void {
  try {
    sessionStorage.setItem(NUMA_REPAIR_QUIET_FLAG, String(now));
  } catch {
    // ignore
  }
}

/** True while a repair navigation is in flight — PwaRegister must not reload. */
export function isRepairQuietWindowActive(now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(NUMA_REPAIR_QUIET_FLAG);
    if (!raw) return false;
    const started = Number(raw);
    if (!Number.isFinite(started)) {
      sessionStorage.removeItem(NUMA_REPAIR_QUIET_FLAG);
      return false;
    }
    if (now - started > REPAIR_QUIET_MS) {
      sessionStorage.removeItem(NUMA_REPAIR_QUIET_FLAG);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Wipe Cache Storage + local repair flags.
 *
 * Do NOT call registration.update() or post skip-waiting here. The worker
 * already skipWaiting()s on install; update() would activate it and fire
 * PwaRegister's controllerchange → location.reload() while still on /laga.
 * Cache wipe + a calm navigate to Hem is enough; PwaRegister still picks up
 * new /sw.js on the next focus/pageshow.
 */
export async function clearNumaRuntimeCache(): Promise<void> {
  beginRepairQuietWindow();

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
 * Leave /laga for Hem after repair. Quiet window stays active so a late
 * controllerchange cannot reload back onto Uppdatera appen.
 */
export function navigateAfterRepair(path = "/idag"): void {
  if (typeof window === "undefined") return;
  beginRepairQuietWindow();
  const url = new URL(path, window.location.origin);
  url.searchParams.set("r", String(Date.now()));
  window.setTimeout(() => {
    window.location.assign(url.href);
  }, 150);
}
