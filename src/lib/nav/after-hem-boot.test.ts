import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./after-hem-boot.ts", import.meta.url), "utf8");

describe("afterHemBoot", () => {
  it("gates cold menu IO on Hem session confirm with idle + fail-open", () => {
    expect(src).toContain("isHomeSessionConfirmed");
    expect(src).toContain("subscribeHomeSnapshot");
    expect(src).toContain("requestIdleCallback");
    expect(src).toContain("AFTER_HEM_BOOT_FAIL_OPEN_MS");
    expect(src).toContain("2_500");
    // Idle after confirm so urgent quiet warm can claim the wire first.
    const finish = src.slice(src.indexOf("const finish"), src.indexOf("const unsub"));
    expect(finish).toContain("requestIdleCallback");
    expect(finish.indexOf("unsub()")).toBeLessThan(
      finish.indexOf("requestIdleCallback"),
    );
  });
});
