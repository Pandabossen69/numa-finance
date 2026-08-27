import { cache } from "react";
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

export const loadOnboardingState = cache(
  async (): Promise<OnboardingState> => {
    const user = await getSessionUser();
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

    let profile: Profile | null = null;
    let accounts: Account[] = [];
    try {
      const loaded = await Promise.all([getProfile(), listAccounts()]);
      profile = loaded[0];
      accounts = loaded[1];
    } catch (error) {
      console.error("[numa] onboarding state failed", error);
    }

    const hasAccounts = accounts.length > 0;
    const gate: OnboardingGateInput = {
      email: user.email,
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
      onboardingSaldoAt: profile?.onboardingSaldoAt ?? null,
      hasAccounts,
      hasSaldo: hasAccounts,
    };
    const phase = resolveOnboardingPhase(gate);
    return {
      phase,
      nextPath: pathForOnboardingPhase(phase),
      gate,
      profile,
      accounts,
    };
  },
);
