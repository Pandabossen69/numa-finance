import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("ordinary login and session refresh stay on the existing path", () => {
  it("keeps password sign-in, cookie refresh, and JWT skew retry", () => {
    const actions = read("./actions.ts");
    const authUser = read("../../lib/supabase/auth-user.ts");
    const middleware = read("../../lib/supabase/middleware.ts");
    const jwt = read("../../lib/supabase/jwt-issued-at.ts");
    const server = read("../../lib/supabase/server.ts");

    expect(actions).toContain("signInWithPassword");
    expect(actions).toContain("rejectPublicSignup");
    expect(authUser).toContain("auth.getSession()");
    expect(authUser).toContain("export const getAuthUser = cache");
    expect(middleware).toContain("supabase.auth.getUser()");
    expect(middleware).toContain("shouldSkipProxyGetUser");
    expect(jwt).toContain("fetchWithJwtIssuedAtRetry");
    expect(jwt).toContain("AbortController");
    expect(server).toContain("fetchWithJwtIssuedAtRetry");
  });
});
