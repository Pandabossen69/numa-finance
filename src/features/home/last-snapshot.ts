import type { HomeSnapshot } from "@/features/finance/load-home";
import type { AnalysSnapshot } from "@/features/finance/load-analys";

let home: HomeSnapshot | null = null;
let analys: AnalysSnapshot | null = null;

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
