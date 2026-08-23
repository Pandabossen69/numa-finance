import type { HomeSnapshot } from "@/features/finance/load-home";
import type { AnalysSnapshot } from "@/features/finance/load-analys";

let home: HomeSnapshot | null = null;
let analys: AnalysSnapshot | null = null;
let planView: { monthKey: string; viewYear: number } | null = null;
let analysScope: "period" | "month" | null = null;

export function rememberHomeSnapshot(snap: HomeSnapshot) {
  home = snap;
}

export function lastHomeSnapshot(): HomeSnapshot | null {
  return home;
}

export function rememberAnalysSnapshot(snap: AnalysSnapshot) {
  analys = snap;
}

export function lastAnalysSnapshot(): AnalysSnapshot | null {
  return analys;
}

export function rememberPlanView(view: { monthKey: string; viewYear: number }) {
  planView = view;
}

export function lastPlanView(): { monthKey: string; viewYear: number } | null {
  return planView;
}

export function rememberAnalysScope(scope: "period" | "month") {
  analysScope = scope;
}

export function lastAnalysScope(): "period" | "month" | null {
  return analysScope;
}
