"use client";

import nextDynamic from "next/dynamic";
import {
  AnalysPending,
  HemPending,
  ViewLoading,
} from "@/components/layout/ViewLoading";

/** Route-boundary islands — keep heavy screens off the first shared JS. */
export const HomeDashboard = nextDynamic(
  () => import("@/components/home/HomeDashboard").then((mod) => mod.HomeDashboard),
  { ssr: true, loading: () => <HemPending /> },
);

export const PlanEditor = nextDynamic(
  () => import("@/components/plan/PlanEditor").then((mod) => mod.PlanEditor),
  { ssr: true, loading: () => <ViewLoading /> },
);

export const PlanScreen = nextDynamic(
  () => import("@/components/plan/PlanScreen").then((mod) => mod.PlanScreen),
  { ssr: true, loading: () => <ViewLoading /> },
);

export const AnalysDashboard = nextDynamic(
  () =>
    import("@/components/analys/AnalysDashboard").then((mod) => mod.AnalysDashboard),
  { ssr: true, loading: () => <AnalysPending /> },
);

export const ReceiptCaptureFlow = nextDynamic(
  () =>
    import("@/components/capture/ReceiptCaptureFlow").then(
      (mod) => mod.ReceiptCaptureFlow,
    ),
  /* Soft-nav Mer→Fota: calm Laddar… while the island loads — never blank dark. */
  { ssr: false, loading: () => <ViewLoading /> },
);

export const MovementsScreen = nextDynamic(
  () =>
    import("@/components/movements/MovementsScreen").then(
      (mod) => mod.MovementsScreen,
    ),
  { ssr: true, loading: () => <ViewLoading /> },
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
