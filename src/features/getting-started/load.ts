import { cache } from "react";
import { getSessionUser } from "@/features/auth/session";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import {
  buildGettingStartedView,
  type GettingStartedView,
} from "./progress";

export const loadGettingStartedView = cache(
  async (): Promise<GettingStartedView | null> => {
    const [user, snap] = await Promise.all([
      getSessionUser(),
      getCachedTodaySnapshot().catch(() => null),
    ]);
    if (!user || !snap) return null;
    return buildGettingStartedView({
      email: user.email,
      gettingStartedCompletedAt: snap.profile.gettingStartedCompletedAt,
      gettingStartedCollapsed: snap.profile.gettingStartedCollapsed,
      hasSaldo: snap.checkpoint != null,
      planItems: snap.planItems ?? [],
    });
  },
);
