export const ONBOARDING_SALDO_PATH = "/kom-igang";
export const ONBOARDING_FOTA_PATH = "/kom-igang/fota";
export const ONBOARDING_MANUAL_PATH = "/kom-igang/manuellt";
export const ONBOARDING_PLAN_PATH = "/kom-igang/plan";
export const HOME_PATH = "/idag";

export function isOnboardingPath(pathname: string): boolean {
  return pathname === ONBOARDING_SALDO_PATH || pathname.startsWith(`${ONBOARDING_SALDO_PATH}/`);
}
