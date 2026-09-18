"use client";

export type PlanFocusAdd = "income" | "fixed";

export type PlanFocus = {
  focusAdd: PlanFocusAdd | null;
  stepHint: string | null;
};

const EMPTY_FOCUS: PlanFocus = { focusAdd: null, stepHint: null };

let focus: PlanFocus = EMPTY_FOCUS;
const listeners = new Set<() => void>();

export function planFocusFromSteg(steg: string | null): PlanFocus {
  if (steg === "inkomst") {
    return {
      focusAdd: "income",
      stepHint:
        "Steg 2 av 3. Här lägger du in det som kommer in — lön eller CSN.",
    };
  }
  if (steg === "utgift") {
    return {
      focusAdd: "fixed",
      stepHint:
        "Steg 3 av 3. Här lägger du in det som måste betalas — hyra eller räkning.",
    };
  }
  return EMPTY_FOCUS;
}

export function rememberPlanFocus(next: PlanFocus) {
  if (focus.focusAdd === next.focusAdd && focus.stepHint === next.stepHint) {
    return;
  }
  focus = next;
  for (const listener of listeners) listener();
}

export function rememberPlanFocusFromHref(href: string) {
  let steg: string | null = null;
  try {
    steg = new URL(href, "http://numa.local").searchParams.get("steg");
  } catch {
    steg = null;
  }
  rememberPlanFocus(planFocusFromSteg(steg));
}

export function lastPlanFocus(): PlanFocus {
  return focus;
}

export function subscribePlanFocus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetPlanFocusForTests() {
  focus = EMPTY_FOCUS;
  listeners.clear();
}
