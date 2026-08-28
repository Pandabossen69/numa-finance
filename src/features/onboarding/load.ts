import { cache } from "react";
import { isNumaAdminEmail } from "@/domain/identity/admin";
import { getSessionUser } from "@/features/auth/session";
import { getProfile, listAccounts } from "@/lib/store/repository";
import {
  pathForOnboardingPhase,
  resolveOnboardingPhase,
  type OnboardingGateInput,
  type OnboardingPhase,
} from "./gate";
import type { Profile } from "@/domain/finance";
import type { Account } from "@/domain/finance";

export type OnboardingState = {
  phase: OnboardingPhase;
  nextPath: string;
  gate: OnboardingGateInput;
  profile: Profile | null;
  accounts: Account[];
};

function stateFromGate(
  gate: OnboardingGateInput,
  profile: Profile | null,
  accounts: Account[],
): OnboardingState {
  const phase = resolveOnboardingPhase(gate);
  return {
    phase,
    nextPath: pathForOnboardingPhase(phase),
    gate,
    profile,
    accounts,
  };
}

export const loadOnboardingState = cache(
  async (): Promise<OnboardingState> => {
    // Kick profile + accounts with the session so we never wait
    // session → profile → accounts on the first-login path.
    const userPromise = getSessionUser();
    const profilePromise = getProfile().catch((error) => {
      console.error("[numa] onboarding profile failed", error);
      return null;
    });
    const accountsPromise = listAccounts().catch((error) => {
      console.error("[numa] onboarding accounts failed", error);
      return [] as Account[];
    });

    const user = await userPromise;
    if (!user) {
      const gate: OnboardingGateInput = {
        email: "",
        onboardingCompletedAt: null,
        onboardingSaldoAt: null,
        hasAccounts: false,
        hasSaldo: false,
      };
      return {
        phase: "done",
        nextPath: "/logga-in",
        gate,
        profile: null,
        accounts: [],
      };
    }

    if (isNumaAdminEmail(user.email)) {
      const gate: OnboardingGateInput = {
        email: user.email,
        onboardingCompletedAt: null,
        onboardingSaldoAt: null,
        hasAccounts: false,
        hasSaldo: false,
      };
      return stateFromGate(gate, null, []);
    }

    const profile = await profilePromise;
    if (profile?.onboardingCompletedAt || profile?.onboardingSaldoAt) {
      const gate: OnboardingGateInput = {
        email: user.email,
        onboardingCompletedAt: profile.onboardingCompletedAt,
        onboardingSaldoAt: profile.onboardingSaldoAt,
        hasAccounts: true,
        hasSaldo: true,
      };
      return stateFromGate(gate, profile, []);
    }

    const accounts = await accountsPromise;
    const hasAccounts = accounts.length > 0;
    const gate: OnboardingGateInput = {
      email: user.email,
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
      onboardingSaldoAt: profile?.onboardingSaldoAt ?? null,
      hasAccounts,
      hasSaldo: hasAccounts,
    };
    return stateFromGate(gate, profile, accounts);
  },
);
