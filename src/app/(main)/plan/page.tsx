import { PlanRouteClient } from "@/components/plan/PlanRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Plan. RSC no longer awaits the TodaySnapshot — last-known paints
 * immediately and a quiet action refreshes in the background (NextStep pattern).
 */
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

  return <PlanRouteClient focusAdd={focusAdd} stepHint={hint} />;
}
