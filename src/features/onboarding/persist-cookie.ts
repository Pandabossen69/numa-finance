import { cookies } from "next/headers";
import {
  ONBOARDING_COOKIE,
  onboardingCookieOptions,
  parseOnboardingCookie,
  type OnboardingCookieValue,
} from "./cookie";

export async function peekOnboardingCookie(): Promise<OnboardingCookieValue | null> {
  try {
    const store = await cookies();
    return parseOnboardingCookie(store.get(ONBOARDING_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function persistOnboardingPhaseCookie(
  phase: OnboardingCookieValue,
): Promise<void> {
  try {
    const store = await cookies();
    store.set(ONBOARDING_COOKIE, phase, onboardingCookieOptions());
  } catch {
    // Server Components cannot set cookies — login/stamp actions do.
  }
}

export async function clearOnboardingCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(ONBOARDING_COOKIE);
  } catch {
    // Same as persist — ignore when headers are read-only.
  }
}
