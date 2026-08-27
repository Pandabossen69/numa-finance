import { isNumaAdminEmail } from "@/domain/identity/admin";
import { HOME_PATH, ONBOARDING_SALDO_PATH } from "./paths";

export type OnboardingPhase = "saldo" | "done";

export type OnboardingGateInput = {
  email: string;
  onboardingCompletedAt: string | null;
  onboardingSaldoAt: string | null;
  hasAccounts: boolean;
  hasSaldo: boolean;
};

/**
 * Blocking first-run is only the starting saldo.
 * Hugo and anyone with accounts/saldo skip it. Plan is guided on Hem after.
 */
export function resolveOnboardingPhase(
  input: OnboardingGateInput,
): OnboardingPhase {
  if (isNumaAdminEmail(input.email)) return "done";
  if (input.onboardingCompletedAt) return "done";
  if (input.onboardingSaldoAt) return "done";
  if (input.hasSaldo || input.hasAccounts) return "done";
  return "saldo";
}

export function pathForOnboardingPhase(phase: OnboardingPhase): string {
  return phase === "saldo" ? ONBOARDING_SALDO_PATH : HOME_PATH;
}

export function needsSaldoOnboarding(input: OnboardingGateInput): boolean {
  return resolveOnboardingPhase(input) === "saldo";
}
