import { describe, expect, it } from "vitest";
import { PRODUCTION_ORIGIN } from "@/lib/site";
import {
  PASSWORD_MISMATCH,
  PASSWORD_RESET_FAILED_MESSAGE,
  PASSWORD_RESET_INVALID_EMAIL,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  PASSWORD_RESET_RATE_LIMIT_MESSAGE,
  PASSWORD_TOO_SHORT,
  RECOVERY_LINK_INVALID_MESSAGE,
  classifyPasswordResetError,
  passwordResetRedirectTo,
  passwordResetUserMessage,
  publicSiteOrigin,
  recoveryFailureParam,
  swedishPasswordUpdateError,
  validateNewPassword,
} from "./password-reset";

describe("password reset redirect", () => {
  it("uses the request host so preview mail returns to that preview", () => {
    const origin = publicSiteOrigin({
      forwardedHost: "numa-finance-git-foo-team.vercel.app",
      forwardedProto: "https",
      appUrl: "https://numa-finance.vercel.app",
    });
    expect(origin).toBe("https://numa-finance-git-foo-team.vercel.app");
    expect(passwordResetRedirectTo(origin)).toBe(
      "https://numa-finance-git-foo-team.vercel.app/nytt-losenord",
    );
  });

  it("falls back to NEXT_PUBLIC_APP_URL, then production", () => {
    expect(
      publicSiteOrigin({
        appUrl: "https://numa-finance.vercel.app/idag",
      }),
    ).toBe("https://numa-finance.vercel.app");
    expect(publicSiteOrigin({})).toBe(PRODUCTION_ORIGIN);
    expect(passwordResetRedirectTo(PRODUCTION_ORIGIN)).toBe(
      `${PRODUCTION_ORIGIN}/nytt-losenord`,
    );
  });

  it("treats localhost as http when proto is missing", () => {
    expect(publicSiteOrigin({ host: "localhost:3000" })).toBe("http://localhost:3000");
    expect(
      publicSiteOrigin({
        forwardedHost: "evil.example, numa-finance.vercel.app",
        forwardedProto: "https",
      }),
    ).toBe("https://evil.example");
  });
});

describe("password reset responses", () => {
  it("always uses the neutral copy, including when the address is unknown", () => {
    for (const message of [
      "User not found",
      "user_not_found",
      "User does not exist",
      "Email not found",
      "Signups not allowed for this instance",
    ]) {
      expect(classifyPasswordResetError(message, message)).toBe("neutral");
    }
    expect(passwordResetUserMessage("neutral")).toEqual({
      ok: true,
      message: PASSWORD_RESET_NEUTRAL_MESSAGE,
    });
    expect(PASSWORD_RESET_NEUTRAL_MESSAGE).toBe(
      "Om adressen finns skickar vi en länk inom några minuter.",
    );
  });

  it("maps email_address_invalid to the neutral success state", () => {
    const samples: Array<{ message: string; code: string | null }> = [
      { message: "email_address_invalid", code: "email_address_invalid" },
      {
        message: 'Email address "test@gmail.com" is invalid',
        code: "email_address_invalid",
      },
      { message: "Unable to validate email address", code: "validation_failed" },
      { message: "user_not_found", code: "user_not_found" },
    ];
    for (const sample of samples) {
      expect(classifyPasswordResetError(sample.message, sample.code)).toBe("neutral");
      expect(passwordResetUserMessage("neutral")).toEqual({
        ok: true,
        message: "Om adressen finns skickar vi en länk inom några minuter.",
      });
    }
    expect(PASSWORD_RESET_INVALID_EMAIL).toBe("Ogiltig e-postadress");
  });

  it("keeps Swedish rate-limit and network errors", () => {
    expect(classifyPasswordResetError("Email rate limit exceeded")).toBe("rate-limit");
    expect(
      classifyPasswordResetError(
        "For security purposes, you can only request this after 60 seconds",
      ),
    ).toBe("rate-limit");
    expect(
      classifyPasswordResetError("over_request_rate_limit", "over_request_rate_limit"),
    ).toBe("rate-limit");
    expect(passwordResetUserMessage("rate-limit")).toEqual({
      ok: false,
      error: PASSWORD_RESET_RATE_LIMIT_MESSAGE,
    });
    expect(classifyPasswordResetError("Failed to fetch", "network_error")).toBe("failed");
    expect(passwordResetUserMessage("failed")).toEqual({
      ok: false,
      error: PASSWORD_RESET_FAILED_MESSAGE,
    });
    expect(recoveryFailureParam("over_request_rate_limit")).toBe("grans");
    expect(recoveryFailureParam("otp expired")).toBe("ogiltig");
  });
});

describe("new password", () => {
  it("requires min length and a match", () => {
    expect(validateNewPassword("kort", "kort")).toBe(PASSWORD_TOO_SHORT);
    expect(validateNewPassword("lösenord1", "lösenord2")).toBe(PASSWORD_MISMATCH);
    expect(validateNewPassword("lösenord1", "lösenord1")).toBeNull();
  });

  it("translates update failures", () => {
    expect(swedishPasswordUpdateError("Email rate limit exceeded")).toBe(
      PASSWORD_RESET_RATE_LIMIT_MESSAGE,
    );
    expect(swedishPasswordUpdateError("New password should be different")).toBe(
      "Välj ett annat lösenord än det nuvarande.",
    );
    expect(swedishPasswordUpdateError("Auth session missing")).toBe(
      RECOVERY_LINK_INVALID_MESSAGE,
    );
    expect(swedishPasswordUpdateError("boom")).toBe(
      "Kunde inte spara lösenordet. Försök igen.",
    );
  });
});
