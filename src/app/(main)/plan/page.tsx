import { loadPlanSnapshot } from "@/features/finance/load-plan";
import { loadGettingStartedView } from "@/features/getting-started/load";
import { PlanScreen } from "@/lib/route-islands";

export const dynamic = "force-dynamic";

export default async function PlanPage({
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
  const [result, gettingStarted] = await Promise.all([
    loadPlanSnapshot(),
    loadGettingStartedView(),
  ]);

  return (
    <PlanScreen
      focusAdd={focusAdd}
      stepHint={hint}
      initial={result.ok ? result.data : null}
      initialError={result.ok ? null : result.error}
      initialGettingStarted={gettingStarted}
    />
  );
}
