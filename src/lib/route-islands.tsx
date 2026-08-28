"use client";

import nextDynamic from "next/dynamic";
import {
  AnalysViewLoading,
  HomeViewLoading,
  ViewLoading,
} from "@/components/layout/ViewLoading";

/** Route-boundary islands — keep heavy screens off the first shared JS. */
export const HomeDashboard = nextDynamic(
  () => import("@/components/home/HomeDashboard").then((mod) => mod.HomeDashboard),
  { ssr: false, loading: () => <HomeViewLoading /> },
);

export const PlanEditor = nextDynamic(
  () => import("@/components/plan/PlanEditor").then((mod) => mod.PlanEditor),
  { ssr: false, loading: () => <ViewLoading /> },
);

export const AnalysDashboard = nextDynamic(
  () =>
    import("@/components/analys/AnalysDashboard").then((mod) => mod.AnalysDashboard),
  { ssr: false, loading: () => <AnalysViewLoading /> },
);

export const ReceiptCaptureFlow = nextDynamic(
  () =>
    import("@/components/capture/ReceiptCaptureFlow").then(
      (mod) => mod.ReceiptCaptureFlow,
    ),
  { ssr: false },
);

export const MovementsScreen = nextDynamic(
  () =>
    import("@/components/movements/MovementsScreen").then(
      (mod) => mod.MovementsScreen,
    ),
  { ssr: false },
);

export const OnboardingSaldoChoice = nextDynamic(
  () =>
    import("@/components/onboarding/OnboardingSaldoChoice").then(
      (mod) => mod.OnboardingSaldoChoice,
    ),
  { ssr: false },
);

export const OnboardingManualSaldo = nextDynamic(
  () =>
    import("@/components/onboarding/OnboardingManualSaldo").then(
      (mod) => mod.OnboardingManualSaldo,
    ),
  { ssr: false },
);
