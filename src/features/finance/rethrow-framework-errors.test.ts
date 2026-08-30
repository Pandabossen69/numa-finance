import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The snapshot loaders catch everything so a failed read renders an error
 * card instead of a blank screen. But `cookies()`, `redirect()` and
 * `notFound()` throw for Next to catch — swallowing those breaks the
 * static/dynamic bail-out and silently eats redirects.
 */
const loaders = [
  "load-home.ts",
  "load-plan.ts",
  "load-analys.ts",
  "load-movements.ts",
  "load-accounts.ts",
];

describe("server loaders", () => {
  for (const file of loaders) {
    it(`${file} rethrows framework errors before logging`, () => {
      const src = readFileSync(new URL(file, import.meta.url), "utf8");
      const logs = src.match(/console\.error\("\[numa\] load\w+ failed"/g) ?? [];
      const guarded =
        src.match(
          /unstable_rethrow\(error\);\s*\n\s*console\.error\("\[numa\] load\w+ failed"/g,
        ) ?? [];
      expect(logs.length).toBeGreaterThan(0);
      expect(guarded.length).toBe(logs.length);
    });
  }

  it("onboarding rethrows too", () => {
    const src = readFileSync(
      new URL("../onboarding/load.ts", import.meta.url),
      "utf8",
    );
    const rethrows = src.match(/unstable_rethrow\(error\)/g) ?? [];
    const logs = src.match(/console\.error\("\[numa\] onboarding/g) ?? [];
    expect(rethrows.length).toBe(logs.length);
  });
});
