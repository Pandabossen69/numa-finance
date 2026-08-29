import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSubmitLock } from "./submit-guard";

const componentsDir = new URL("../../components", import.meta.url).pathname;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * Every form that writes money must hold the synchronous guard, not just a
 * pending flag. Two taps in the same frame would otherwise book twice.
 */
const MONEY_FORMS = [
  "add/QuickAddForms.tsx",
  "home/HomeDashboard.tsx",
  "accounts/CreateAccountForm.tsx",
  "accounts/VerifyBalanceForm.tsx",
  "onboarding/OnboardingManualSaldo.tsx",
];

describe("submit lock", () => {
  it("lets the first tap through and refuses the rest of the burst", () => {
    const lock = createSubmitLock();
    expect(lock.tryBegin()).toBe(true);
    expect(lock.tryBegin()).toBe(false);
    expect(lock.tryBegin()).toBe(false);
    expect(lock.isRunning()).toBe(true);
  });

  it("takes the next write once the first one settles", () => {
    const lock = createSubmitLock();
    lock.tryBegin();
    lock.end();
    expect(lock.isRunning()).toBe(false);
    expect(lock.tryBegin()).toBe(true);
  });

  it("keeps one form's lock independent of another's", () => {
    const a = createSubmitLock();
    const b = createSubmitLock();
    expect(a.tryBegin()).toBe(true);
    expect(b.tryBegin()).toBe(true);
  });
});

describe("double-submit guard", () => {
  it("guards every money form", () => {
    for (const relative of MONEY_FORMS) {
      const src = readFileSync(path.join(componentsDir, relative), "utf8");
      expect(src, `${relative} must use the shared guard`).toContain(
        "useSubmitGuard",
      );
      expect(src, `${relative} must refuse a second tap`).toContain(
        "tryBegin()",
      );
      // Release either by handing the hook the pending flag or by hand.
      const releases =
        /useSubmitGuard\((?:pending|busy)\)/.test(src) || src.includes("end()");
      expect(releases, `${relative} must release the guard`).toBe(true);
    }
  });

  it("has no ad-hoc in-flight ref left behind", () => {
    const offenders = tsxFiles(componentsDir)
      .filter((file) => readFileSync(file, "utf8").includes("inFlight.current"))
      .map((file) => path.relative(componentsDir, file));
    expect(offenders).toEqual([]);
  });
});
