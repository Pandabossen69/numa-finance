import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PwaRegister.tsx", import.meta.url), "utf8");

describe("PWA version nudge", () => {
  it("registers sw.js with a build id and offers a soft reload", () => {
    expect(src).toContain('serviceWorker.register("/sw.js"');
    expect(src).not.toContain("/sw.js?v=");
    expect(src).toContain("Ny version — uppdatera");
    expect(src).toContain("SKIP_WAITING");
    expect(src).not.toContain("location.replace");
  });
});
