import { Suspense } from "react";
import { PlanFirstPaint } from "@/components/layout/HemFirstPaint";
import { loadPlanSnapshot } from "@/features/finance/load-plan";
import { loadGettingStartedView } from "@/features/getting-started/load";
import { PlanScreen } from "@/lib/route-islands";

export const dynamic = "force-dynamic";

export default function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ steg?: string }>;
}) {
  return (
    <Suspense fallback={<PlanFirstPaint />}>
      <PlanFromParams searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanFromParams({
  searchParams,
}: {
  searchParams?: Promise<{ steg?: string }>;
}) {
  const steg = (await searchParams)?.steg ?? "";
  const hint =
    steg === "inkomst"
      ? "Här lägger du in det som kommer in."
      : steg === "utgift"
        ? "Här lägger du in det som måste betalas."
        : null;
  const focusAdd =
    steg === "inkomst" ? "income" : steg === "utgift" ? "fixed" : null;

  return <PlanBody focusAdd={focusAdd} stepHint={hint} />;
}

async function PlanBody({
  focusAdd,
  stepHint,
}: {
  focusAdd: "income" | "fixed" | null;
  stepHint: string | null;
}) {
  const [result, gettingStarted] = await Promise.all([
    loadPlanSnapshot(),
    loadGettingStartedView(),
  ]);

  return (
    <PlanScreen
      focusAdd={focusAdd}
      stepHint={stepHint}
      initial={result.ok ? result.data : null}
      initialError={result.ok ? null : result.error}
      initialGettingStarted={gettingStarted}
    />
  );
}
