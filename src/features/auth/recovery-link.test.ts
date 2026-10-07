import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  newPasswordEntry,
  recoveryCallbackHref,
  recoveryLinkFromLocation,
} from "./recovery-link";

describe("recovery link", () => {
  it("sends a PKCE code to the auth callback", () => {
    const link = recoveryLinkFromLocation("?code=abc-123");
    expect(link).toEqual({ kind: "code", code: "abc-123" });
    if (link.kind !== "code") return;
    expect(recoveryCallbackHref(link)).toBe("/auth/callback?code=abc-123");
    expect(newPasswordEntry(new URLSearchParams("code=abc-123"))).toEqual({
      type: "exchange",
      href: "/auth/callback?code=abc-123",
    });
  });

  it("sends a recovery token hash to verifyOtp", () => {
    const link = recoveryLinkFromLocation("?token_hash=th_1&type=recovery");
    expect(link).toEqual({ kind: "otp", tokenHash: "th_1" });
    if (link.kind !== "otp") return;
    expect(recoveryCallbackHref(link)).toBe(
      "/auth/callback?token_hash=th_1&type=recovery",
    );
  });

  it("treats expired, denied, and our own fel flag as a dead link", () => {
    expect(
      recoveryLinkFromLocation("?error=access_denied&error_code=otp_expired"),
    ).toEqual({ kind: "error" });
    expect(
      recoveryLinkFromLocation("", "#error=access_denied&error_code=otp_expired"),
    ).toEqual({ kind: "error" });
    expect(newPasswordEntry(new URLSearchParams("fel=ogiltig"))).toEqual({
      type: "invalid",
    });
    expect(newPasswordEntry(new URLSearchParams("fel=grans"))).toEqual({
      type: "rate-limit",
    });
    expect(recoveryLinkFromLocation("?token_hash=th_1&type=signup")).toEqual({
      kind: "error",
    });
  });

  it("recognises an implicit recovery hash and an empty landing", () => {
    expect(recoveryLinkFromLocation("", "#access_token=tok&type=recovery")).toEqual({
      kind: "hash-session",
    });
    expect(recoveryLinkFromLocation("")).toEqual({ kind: "none" });
    expect(newPasswordEntry(new URLSearchParams())).toEqual({
      type: "check-session",
    });
  });
});

describe("public auth pages stay invite-only", () => {
  it("exchanges the code in the callback and does not open signup", () => {
    const callback = readFileSync(
      new URL("../../app/auth/callback/route.ts", import.meta.url),
      "utf8",
    );
    const resetPage = readFileSync(
      new URL("../../app/nytt-losenord/page.tsx", import.meta.url),
      "utf8",
    );
    const forgot = readFileSync(
      new URL("../../components/auth/ForgotPasswordForm.tsx", import.meta.url),
      "utf8",
    );
    const invite = readFileSync(
      new URL("../../components/auth/InviteOnly.tsx", import.meta.url),
      "utf8",
    );
    const registrera = readFileSync(
      new URL("../../app/registrera/page.tsx", import.meta.url),
      "utf8",
    );
    const signup = readFileSync(
      new URL("../../app/signup/page.tsx", import.meta.url),
      "utf8",
    );
    const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(callback).toContain("exchangeCodeForSession");
    expect(callback).toContain('type: "recovery"');
    expect(callback).toContain("verifyOtp");
    expect(callback).toContain('"/nytt-losenord"');
    expect(resetPage).toContain("newPasswordEntry");
    expect(resetPage).toContain("redirect(entry.href)");
    expect(forgot).toContain("requestPasswordResetAction");
    expect(forgot).toContain("disabled={pending || !email.trim()}");
    expect(forgot).toContain("Skickar…");
    expect(actions).toContain("resetPasswordForEmail");
    expect(actions).toContain("passwordResetRedirectTo");
    expect(actions).toContain("classifyPasswordResetError");
    expect(actions).toContain("signInWithPassword");
    expect(actions).toContain("finishSignedIn");
    expect(actions).not.toContain(".auth.signUp(");
    expect(invite).toContain("INVITE_ONLY_TITLE");
    expect(invite).toContain('href="/logga-in"');
    expect(invite).not.toContain("signUpAction");
    expect(registrera).toContain("InviteOnly");
    expect(registrera).not.toContain("redirect(");
    expect(signup).toContain("InviteOnly");
    expect(signup).not.toContain("redirect(");
  });
});
