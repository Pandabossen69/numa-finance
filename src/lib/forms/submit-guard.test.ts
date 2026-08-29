import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
