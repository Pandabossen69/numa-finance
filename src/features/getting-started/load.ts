import { cache } from "react";
import { isNumaAdminEmail } from "@/domain/identity/admin";
import { getSessionUser } from "@/features/auth/session";
import { getProfile, listAccounts, listPlanItems } from "@/lib/store/repository";
import {
  buildGettingStartedView,
  type GettingStartedView,
} from "./progress";

/**
 * Checklist only — never wait on Hem's ledger snapshot (transactions,
 * checkpoints, user_progress). New users must not share Hugo's query set.
 */
export const loadGettingStartedView = cache(
  async (): Promise<GettingStartedView | null> => {
    const userPromise = getSessionUser();
    const profilePromise = getProfile().catch(() => null);
    const planPromise = listPlanItems().catch(() => []);
    const accountsPromise = listAccounts().catch(() => []);

    const user = await userPromise;
    if (!user) return null;
    if (isNumaAdminEmail(user.email)) return null;

    const [profile, planItems, accounts] = await Promise.all([
      profilePromise,
      planPromise,
      accountsPromise,
    ]);
    if (!profile) return null;

    return buildGettingStartedView({
      email: user.email,
      gettingStartedCompletedAt: profile.gettingStartedCompletedAt,
      gettingStartedCollapsed: profile.gettingStartedCollapsed,
      hasSaldo:
        Boolean(profile.onboardingSaldoAt) || accounts.length > 0,
      planItems,
      onboardingSaldoAt: profile.onboardingSaldoAt,
    });
  },
);
