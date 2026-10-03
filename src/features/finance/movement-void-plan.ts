import { invalidateSettledHomeSurfaces } from "@/features/home/invalidate-settled-home";

/** A Rörelser row the live `void_settle_reconcile` trigger can reopen on Plan. */
export function movementVoidsPlanLink(row: {
  planItemId?: string | null;
  linkedPlanItemId?: string | null;
  ledgerOrigin?: string | null;
}): boolean {
  return Boolean(
    row.planItemId ||
      row.linkedPlanItemId ||
      row.ledgerOrigin === "plan_settle",
  );
}

/**
 * After Ta bort / void of a plan-linked movement, drop Plan's month paint and
 * the Hem shell the same way Betald does — so Plan shows the post as open and
 * Hem recomputes without a reload.
 */
export function invalidateAfterPlanLinkedVoid(
  row: {
    planItemId?: string | null;
    linkedPlanItemId?: string | null;
    ledgerOrigin?: string | null;
  },
  invalidate: () => void = invalidateSettledHomeSurfaces,
): boolean {
  if (!movementVoidsPlanLink(row)) return false;
  invalidate();
  return true;
}
