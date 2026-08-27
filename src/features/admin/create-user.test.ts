import { describe, expect, it } from "vitest";
import {
  ADMIN_NOT_FOUND_SV,
  authorizeAdminCreateUser,
  parseCreateUserInput,
  SERVICE_ROLE_MISSING_SV,
  swedishCreateUserError,
} from "./create-user";

describe("authorizeAdminCreateUser", () => {
  it("allows only Qualityltf@gmail.com (case-insensitive)", () => {
    expect(authorizeAdminCreateUser("Qualityltf@gmail.com")).toEqual({
      ok: true,
    });
    expect(authorizeAdminCreateUser("QualityLTF@gmail.com")).toEqual({
      ok: true,
    });
  });

  it("rejects non-admin without leaking that an admin exists", () => {
    expect(authorizeAdminCreateUser("kliv.arne@icloud.com")).toEqual({
      ok: false,
      error: ADMIN_NOT_FOUND_SV,
    });
    expect(authorizeAdminCreateUser("oslin002@gmail.com")).toEqual({
      ok: false,
      error: ADMIN_NOT_FOUND_SV,
    });
    expect(authorizeAdminCreateUser(null)).toEqual({
      ok: false,
      error: ADMIN_NOT_FOUND_SV,
    });
    expect(ADMIN_NOT_FOUND_SV).toBe("Sidan finns inte");
  });
});

describe("parseCreateUserInput", () => {
  it("accepts email + password and optional display name", () => {
    const parsed = parseCreateUserInput({
      email: "  Jordan@Mail.com ",
      password: "abcdefgh",
      displayName: " Jordan ",
    });
    expect(parsed).toEqual({
      ok: true,
      input: {
        email: "jordan@mail.com",
        password: "abcdefgh",
        displayName: "Jordan",
      },
    });
  });

  it("rejects invalid email with Swedish copy", () => {
    const parsed = parseCreateUserInput({
      email: "inte-en-epost",
      password: "abcdefgh",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/e-post/i);
  });

  it("rejects short passwords", () => {
    const parsed = parseCreateUserInput({
      email: "namn@mail.com",
      password: "short",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/8 tecken/i);
  });
});

describe("create-user copy", () => {
  it("documents the Vercel env name when the service role is missing", () => {
    expect(SERVICE_ROLE_MISSING_SV).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(SERVICE_ROLE_MISSING_SV).toMatch(/Vercel/);
  });

  it("maps duplicate Auth users to Swedish", () => {
    expect(
      swedishCreateUserError(
        "A user with this email address has already been registered",
      ),
    ).toBe("E-postadressen finns redan");
  });
});
