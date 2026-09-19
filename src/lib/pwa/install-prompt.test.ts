import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginInstallPromptCapture,
  detectInstallPlatform,
  installGuideSteps,
  installGuideTitle,
  promptInstall,
  readInstallPromptStatus,
  resetInstallPromptForTests,
  wantsProductionInstallAction,
} from "./install-prompt";

function fakeBip(outcome: "accepted" | "dismissed" = "accepted") {
  return {
    preventDefault: vi.fn(),
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  };
}

describe("detectInstallPlatform", () => {
  it("classifies iPhone, iPadOS-as-Mac, Android, and desktop Chromium", () => {
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
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
      }),
    ).toBe("chromium");
    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
      }),
    ).toBe("chromium");
    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/131.0",
        maxTouchPoints: 0,
      }),
    ).toBe("other");
  });
});

describe("installGuideSteps", () => {
  it("keeps iOS, Android and desktop Chromium on separate copy", () => {
    expect(installGuideSteps("ios")).toContain("Dela → Lägg till på hemskärmen");
    expect(installGuideSteps("ios")).toContain("Safari");
    expect(installGuideTitle("ios")).toBe("Installera NUMA som app");

    expect(installGuideSteps("android")).toContain("Installera app");
    expect(installGuideSteps("android")).toContain("menyn");
    expect(installGuideSteps("android")).not.toContain("Dela →");
    expect(installGuideSteps("android")).not.toContain("iPhone");
    expect(installGuideTitle("android")).toBe("Installera NUMA i Chrome");

    expect(installGuideSteps("chromium")).toContain("Chrome eller Edge");
    expect(installGuideSteps("chromium")).not.toContain("iPhone");
    expect(installGuideSteps("chromium")).not.toContain("Android");
    expect(installGuideSteps("chromium")).not.toContain("Dela →");
    expect(installGuideTitle("chromium")).toBe("Installera NUMA i Chrome");
    expect(wantsProductionInstallAction("chromium")).toBe(true);
    expect(wantsProductionInstallAction("ios")).toBe(false);
    expect(wantsProductionInstallAction("android")).toBe(false);

    expect(installGuideSteps("other")).toContain("Chrome");
    expect(installGuideSteps("other")).not.toContain("iPhone");
    expect(installGuideSteps("other")).not.toContain("Android");
    expect(installGuideSteps("other")).not.toContain("Dela →");
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
