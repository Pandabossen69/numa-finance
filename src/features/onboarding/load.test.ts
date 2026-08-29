import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
const redirect = readFileSync(new URL("./redirect.ts", import.meta.url), "utf8");
const session = readFileSync(
  new URL("../auth/session.ts", import.meta.url),
  "utf8",
);
const authUser = readFileSync(
  new URL("../../lib/supabase/auth-user.ts", import.meta.url),
  "utf8",
);
const remote = readFileSync(
  new URL("../../lib/store/supabase-repository.ts", import.meta.url),
  "utf8",
);

describe("onboarding first-load waterfalls", () => {
  it("starts session, profile, and accounts together", () => {
    expect(load).toContain("const userPromise = getSessionUser()");
    expect(load).toContain("const profilePromise = getProfile()");
    expect(load).toContain("const accountsPromise = listAccounts()");
    expect(load).toContain("isNumaAdminEmail(user.email)");
    expect(load).toContain("profile?.onboardingSaldoAt");
    expect(load).not.toMatch(
      /const user = await getSessionUser\(\);\s*if \(!user\)/,
    );
  });

  it("skips the DB gate when the onboarding cookie is done", () => {
    expect(redirect).toContain('peekOnboardingCookie()) === "done"');
    expect(redirect).toContain("redirectIfOnboardingIncomplete");
    expect(redirect).toContain("requireSaldoOnboardingPage");
  });

  it("uses one shared getAuthUser for session and the store", () => {
    expect(authUser).toContain("export const getAuthUser = cache");
    expect(authUser).toContain("auth.getSession()");
    expect(session).toContain("export const getSessionUser = getAuthUser");
    expect(remote).toContain("const user = await getAuthUser()");
    expect(remote).toContain('from "@/lib/supabase/auth-user"');
    expect(remote).not.toContain("supabase.auth.getUser()");
  });
});
