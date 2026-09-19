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
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    const saved = globalThis.localStorage.getItem(LAST_CAPTURE_METHOD_KEY);
    return isCaptureMethodChoice(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function rememberLastCaptureMethod(mode: CaptureMode) {
  if (!isCaptureMethodChoice(mode)) return;
  try {
    if (typeof globalThis.localStorage === "undefined") return;
    globalThis.localStorage.setItem(LAST_CAPTURE_METHOD_KEY, mode);
  } catch {
    // Private mode / quota — picker still works without last-used.
  }
}

export function subscribeLastCaptureMethod(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_CAPTURE_METHOD_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
