import { describe, expect, it } from "vitest";
import { AUTH_COPY, authNoticeFromCode, swedishAuthError } from "./messages";

const SUPABASE_MESSAGES = [
  "Invalid login credentials",
  "Email not confirmed",
  "User already registered",
  "Password should be at least 6 characters",
  "New password should be different from the old password",
  "Email rate limit exceeded",
  "Too many requests",
  "Email link is invalid or has expired",
  "Auth session missing!",
  "Unable to validate email address: invalid format",
  "User not found",
  "Signups not allowed for this instance",
  "captcha protection: request disallowed",
  "fetch failed",
  "Supabase is not configured",
];

function hasAscii(value: string): boolean {
  return /[a-z]/i.test(value);
}

describe("swedishAuthError", () => {
  it("translates the common Supabase messages", () => {
    for (const message of SUPABASE_MESSAGES) {
      const translated = swedishAuthError(message);
      expect(translated, message).not.toBe(message);
      expect(translated, message).not.toBe(AUTH_COPY.genericError);
      expect(hasAscii(translated), message).toBe(true);
    }
  });

  it("never leaks an unknown English message to the UI", () => {
    expect(swedishAuthError("Database error saving new user")).toBe(
      AUTH_COPY.genericError,
    );
    expect(swedishAuthError("weird backend explosion", AUTH_COPY.signInFailed)).toBe(
      AUTH_COPY.signInFailed,
    );
    expect(swedishAuthError(undefined)).toBe(AUTH_COPY.genericError);
    expect(swedishAuthError("")).toBe(AUTH_COPY.genericError);
  });

  it("keeps the wait time from throttling errors", () => {
    expect(
      swedishAuthError(
        "For security purposes, you can only request this after 42 seconds.",
      ),
    ).toBe("Vänta 42 sekunder innan du begär ett nytt mejl.");
  });

  it("maps expired recovery links to the retry copy", () => {
    expect(swedishAuthError("Token has expired or is invalid")).toBe(
      AUTH_COPY.recoveryLinkExpired,
    );
  });

  it("does not point users at the Supabase dashboard", () => {
    const all = [
      ...Object.values(AUTH_COPY),
      ...SUPABASE_MESSAGES.map((message) => swedishAuthError(message)),
    ];
    for (const text of all) {
      expect(text.toLowerCase()).not.toContain("supabase");
      expect(text.toLowerCase()).not.toContain("confirm email");
    }
  });
});

describe("authNoticeFromCode", () => {
  it("returns null without a code", () => {
    expect(authNoticeFromCode(undefined, "login")).toBeNull();
  });

  it("uses reset-specific copy for expired links on the reset page", () => {
    expect(authNoticeFromCode("lank", "reset")).toBe(AUTH_COPY.recoveryLinkExpired);
    expect(authNoticeFromCode("lank", "login")).toBe(AUTH_COPY.emailLinkExpired);
  });

  it("handles repeated query params and unknown codes", () => {
    expect(authNoticeFromCode(["konfiguration"], "login")).toBe(
      AUTH_COPY.notConfigured,
    );
    expect(authNoticeFromCode("nagot-annat", "login")).toBe(AUTH_COPY.genericError);
  });
});
