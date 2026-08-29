import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PwaRegister.tsx", import.meta.url), "utf8");

describe("PWA version nudge", () => {
  it("registers sw.js with a build id and offers a soft reload", () => {
    expect(src).toContain('serviceWorker.register("/sw.js"');
    expect(src).not.toContain("/sw.js?v=");
    expect(src).toContain("requestIdleCallback");
    expect(src).toContain("afterFirstPaint");
    expect(src).toContain("Ny version — uppdatera");
    expect(src).toContain("SKIP_WAITING");
    expect(src).not.toContain("location.replace");
  });

  it("sits above the dock, not over the NUMA logo, and keeps Uppdatera at 44px", () => {
    expect(src).toContain(
      "bottom-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+0.4rem)]",
    );
    expect(src).not.toContain("top-0");
    expect(src).toContain("inline-flex min-h-11 shrink-0 items-center");
  });
});
