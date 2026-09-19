import type { CaptureMode } from "@/features/imports/capture-resume";

/** Device-local last Fota method — same pattern as last expense category. */
export const LAST_CAPTURE_METHOD_KEY = "numa.lastCaptureMethod";

export type CaptureMethodChoice = Exclude<CaptureMode, "pick">;

/** Bank-SMS is the fastest first action on Fota (same as Konton empty-state). */
export const FASTEST_CAPTURE_METHOD: CaptureMethodChoice = "bank_sms";

export const FOTA_QUICK_PATH_COPY = {
  fastest: "Snabbast",
  lastUsed: "Senast",
  fastestAndLast: "Snabbast · senast",
} as const;

const CHOICES = ["bank_sms", "bank_app", "receipt", "manual"] as const;

const listeners = new Set<() => void>();
/** `undefined` = not hydrated on this JS lifetime. */
let cached: CaptureMethodChoice | null | undefined;

function emit() {
  for (const listener of listeners) listener();
}

function readFromLocalStorage(): CaptureMethodChoice | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    const saved = globalThis.localStorage.getItem(LAST_CAPTURE_METHOD_KEY);
    return isCaptureMethodChoice(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function isCaptureMethodChoice(
  value: string | null | undefined,
): value is CaptureMethodChoice {
  return Boolean(value && (CHOICES as readonly string[]).includes(value));
}

export function fotaPickerMark(
  id: CaptureMethodChoice,
  lastUsed: CaptureMethodChoice | null,
): string | null {
  const fastest = id === FASTEST_CAPTURE_METHOD;
  const last = lastUsed === id;
  if (fastest && last) return FOTA_QUICK_PATH_COPY.fastestAndLast;
  if (fastest) return FOTA_QUICK_PATH_COPY.fastest;
  if (last) return FOTA_QUICK_PATH_COPY.lastUsed;
  return null;
}

export function readLastCaptureMethod(): CaptureMethodChoice | null {
  if (cached !== undefined) return cached;
  // SSR: do not freeze cache at null — the client still hydrates from storage.
  if (
    typeof window === "undefined" &&
    typeof globalThis.localStorage === "undefined"
  ) {
    return null;
  }
  cached = readFromLocalStorage();
  return cached;
}

/**
 * Persist last-used and notify same-tab subscribers.
 * `storage` events do not fire in the writing document — in-memory
 * listeners are what keep the Fota picker (and last-view hold) in sync.
 */
export function rememberLastCaptureMethod(mode: CaptureMode) {
  if (!isCaptureMethodChoice(mode)) return;
  cached = mode;
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.setItem(LAST_CAPTURE_METHOD_KEY, mode);
    }
  } catch {
    // Private mode / quota — in-memory last-used still updates this session.
  }
  emit();
}

export function subscribeLastCaptureMethod(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LAST_CAPTURE_METHOD_KEY && event.key !== null) return;
    cached = undefined;
    cached = readFromLocalStorage();
    onStoreChange();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onStoreChange);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Test-only: drop the in-memory cache so cases start unknown. */
export function resetLastCaptureMethodCache() {
  cached = undefined;
}
