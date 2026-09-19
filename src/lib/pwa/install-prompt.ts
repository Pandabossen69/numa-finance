/** Chrome / Edge / Android install event. Not in the default TS lib. */
export type BeforeInstallPromptLike = {
  preventDefault(): void;
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallPromptStatus = "none" | "available" | "accepted";
export type InstallPlatform = "ios" | "android" | "chromium" | "other";

let deferred: BeforeInstallPromptLike | null = null;
let accepted = false;
let prompting = false;
let capturing = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferred = event as unknown as BeforeInstallPromptLike;
  accepted = false;
  emit();
}

function onAppInstalled() {
  deferred = null;
  accepted = true;
  emit();
}

/** Idempotent. Call from the root client shell so the event is not missed. */
export function beginInstallPromptCapture(): () => void {
  if (typeof window === "undefined" || capturing) return () => {};
  capturing = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
    capturing = false;
  };
}

export function subscribeInstallPrompt(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function readInstallPromptStatus(): InstallPromptStatus {
  if (accepted) return "accepted";
  if (deferred) return "available";
  return "none";
}

export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferred || prompting) return "unavailable";
  const event = deferred;
  prompting = true;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null;
    if (outcome === "accepted") accepted = true;
    emit();
    return outcome;
  } catch {
    deferred = null;
    emit();
    return "unavailable";
  } finally {
    prompting = false;
  }
}

export function detectInstallPlatform(input: {
  userAgent: string;
  maxTouchPoints?: number;
}): InstallPlatform {
  const ua = input.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS 13+ reports as Macintosh with touch.
  if (ua.includes("mac") && (input.maxTouchPoints ?? 0) > 1) return "ios";
  if (ua.includes("android")) return "android";
  // Desktop Chrome / Edge / Chromium (preview QA at ~390 is this, not iPhone).
  if (ua.includes("edg/") || ua.includes("edga") || ua.includes("edg ")) {
    return "chromium";
  }
  if (ua.includes("chrome") || ua.includes("chromium")) return "chromium";
  return "other";
}

export function readInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "other";
  try {
    return detectInstallPlatform({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
    });
  } catch {
    return "other";
  }
}

export function installGuideTitle(platform: InstallPlatform): string {
  switch (platform) {
    case "android":
    case "chromium":
      return "Installera NUMA i Chrome";
    default:
      return "Installera NUMA som app";
  }
}

/** Short, platform-specific how-to when the browser never fires BIP. */
export function installGuideSteps(platform: InstallPlatform): string {
  switch (platform) {
    case "ios":
      return "I Safari: Dela → Lägg till på hemskärmen.";
    case "android":
      return "Tryck menyn (⋮) → Installera app.";
    case "chromium":
      return "I Chrome eller Edge: meny → Installera NUMA.";
    default:
      return "Öppna NUMA i Chrome för att installera som app.";
  }
}

export function wantsProductionInstallAction(
  platform: InstallPlatform,
): boolean {
  return platform === "chromium" || platform === "other";
}

/** Test helper — not used by the app. */
export function resetInstallPromptForTests() {
  deferred = null;
  accepted = false;
  prompting = false;
  capturing = false;
  listeners.clear();
}
