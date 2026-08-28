import type { OnboardingPhase } from "./gate";

/** httpOnly marker so Hem chrome can skip the onboarding DB gate. */
export const ONBOARDING_COOKIE = "numa-onboard";

export type OnboardingCookieValue = OnboardingPhase;

export function parseOnboardingCookie(
  value: string | undefined | null,
): OnboardingCookieValue | null {
  if (value === "saldo" || value === "done") return value;
  return null;
}

export function onboardingCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  };
}
