import { redirect } from "next/navigation";
import { loadOnboardingState, type OnboardingState } from "./load";
import { HOME_PATH, ONBOARDING_SALDO_PATH } from "./paths";

/** Hem / Plan / Analys / Mer: empty users stay on the saldo step. */
export async function redirectIfOnboardingIncomplete(): Promise<void> {
  const state = await loadOnboardingState();
  if (state.phase === "saldo") redirect(ONBOARDING_SALDO_PATH);
}

export async function requireSaldoOnboardingPage(): Promise<OnboardingState> {
  const state = await loadOnboardingState();
  if (state.phase === "saldo") return state;
  redirect(HOME_PATH);
}
