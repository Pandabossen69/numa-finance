import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginInstallPromptCapture,
  detectInstallPlatform,
  installGuideSteps,
  promptInstall,
  readInstallPromptStatus,
  resetInstallPromptForTests,
} from "./install-prompt";

function fakeBip(outcome: "accepted" | "dismissed" = "accepted") {
  return {
    preventDefault: vi.fn(),
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  };
}

describe("detectInstallPlatform", () => {
  it("classifies iPhone, iPadOS-as-Mac, and Android", () => {
    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit",
      }),
    ).toBe("ios");
    expect(
      detectInstallPlatform({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
    expect(
      detectInstallPlatform({
        userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0",
      }),
    ).toBe("android");
    expect(
      detectInstallPlatform({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 0,
      }),
    ).toBe("other");
  });
});

describe("installGuideSteps", () => {
  it("gives iOS and Android Chrome their own short path", () => {
    expect(installGuideSteps("ios")).toContain("Dela → Lägg till på hemskärmen");
    expect(installGuideSteps("ios")).toContain("Safari");
    expect(installGuideSteps("android")).toContain("Chrome");
    expect(installGuideSteps("android")).toContain("Installera app");
    expect(installGuideSteps("android")).not.toContain("Dela →");
    expect(installGuideSteps("other")).toContain("iPhone");
    expect(installGuideSteps("other")).toContain("Android");
  });
});

describe("beforeinstallprompt store", () => {
  afterEach(() => {
    resetInstallPromptForTests();
    vi.unstubAllGlobals();
  });

  it("prevents the default banner and keeps the event for a later prompt()", async () => {
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(type, fn);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    });

    beginInstallPromptCapture();
    expect(readInstallPromptStatus()).toBe("none");

    const event = fakeBip("accepted");
    listeners.get("beforeinstallprompt")?.(event as unknown as Event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(readInstallPromptStatus()).toBe("available");

    await expect(promptInstall()).resolves.toBe("accepted");
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(readInstallPromptStatus()).toBe("accepted");
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("clears the deferred prompt on appinstalled without auto-prompting", () => {
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(type, fn);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    });

    beginInstallPromptCapture();
    listeners.get("beforeinstallprompt")?.(fakeBip() as unknown as Event);
    listeners.get("appinstalled")?.(new Event("appinstalled"));

    expect(readInstallPromptStatus()).toBe("accepted");
  });
});
