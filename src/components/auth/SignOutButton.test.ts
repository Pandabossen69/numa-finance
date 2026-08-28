import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./SignOutButton.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("./AuthExperience.tsx", import.meta.url), "utf8");
const onboarding = readFileSync(
  new URL("../../app/(onboarding)/layout.tsx", import.meta.url),
  "utf8",
);
const repair = readFileSync(
  new URL("../../lib/pwa/repair.ts", import.meta.url),
  "utf8",
);

describe("session memory is wiped on logout, login, and /laga", () => {
  it("clears last-known in the browser before the server signs out", () => {
    expect(src).toContain("clearClientSessionMemory");
    expect(src).toContain("signOutAction");
    expect(src.indexOf("clearClientSessionMemory")).toBeLessThan(
      src.indexOf("signOutAction();") > 0
        ? src.indexOf("signOutAction();")
        : src.indexOf("await signOutAction"),
    );
  });

  it("onboarding logout uses the same client wipe", () => {
    expect(onboarding).toContain("SignOutButton");
    expect(onboarding).toContain("Logga ut");
    expect(onboarding).not.toContain("signOutAction");
  });

  it("login wipe happens before the next user's Hem paints", () => {
    expect(login).toContain("clearClientSessionMemory");
    expect(login.indexOf("clearClientSessionMemory")).toBeLessThan(
      login.indexOf("router.replace"),
    );
  });

  it("Laga also drops last-known, not only the service worker", () => {
    expect(repair).toContain("clearClientSessionMemory");
  });
});
