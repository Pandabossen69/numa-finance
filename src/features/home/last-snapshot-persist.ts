import { writeLastHomeCookie } from "@/features/home/last-home-cookie";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { GettingStartedView } from "@/features/getting-started/progress";
import type {
  MerSnapshot,
  MovementsFilter,
  MovementsPeriod,
} from "@/features/home/last-snapshot";

export const LAST_KNOWN_STORAGE_KEY = "numa.lastKnown.v1";

const MAX_MOVEMENT_ITEMS = 50;

export type PersistedLastKnown = {
  v: 1;
  userId: string | null;
  home: HomeSnapshot | null;
  plan: PlanSnapshot | null;
  analys: AnalysSnapshot | null;
  mer: MerSnapshot | null;
  accounts: AccountsSnapshot | null;
  movements: MovementsSnapshot | null;
  gettingStarted: GettingStartedView | null;
  planView: { monthKey: string; viewYear: number } | null;
  analysScope: "period" | "month" | null;
  movementsView: { filter: MovementsFilter; period: MovementsPeriod } | null;
};

function persistStorage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function slimMovements(snap: MovementsSnapshot | null): MovementsSnapshot | null {
  if (!snap || snap.items.length <= MAX_MOVEMENT_ITEMS) return snap;
  return { ...snap, items: snap.items.slice(0, MAX_MOVEMENT_ITEMS) };
}

export function readPersistedLastKnown(): PersistedLastKnown | null {
  const storage = persistStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAST_KNOWN_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as { v?: unknown };
    if (rec.v !== 1) return null;
    return parsed as PersistedLastKnown;
  } catch {
    return null;
  }
}

export function writePersistedLastKnown(data: PersistedLastKnown): void {
  const storage = persistStorage();
  if (!storage) return;
  const payload: PersistedLastKnown = {
    ...data,
    v: 1,
    movements: slimMovements(data.movements),
  };
  writeLastHomeCookie(payload.home);
  try {
    storage.setItem(LAST_KNOWN_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    const previous = readPersistedLastKnown();
    try {
      storage.setItem(
        LAST_KNOWN_STORAGE_KEY,
        JSON.stringify({
          v: 1,
          userId: payload.userId,
          home: payload.home,
          plan: previous?.plan ?? payload.plan,
          analys: previous?.analys ?? payload.analys,
          mer: payload.mer,
          accounts: payload.accounts,
          movements: previous?.movements ?? payload.movements,
          gettingStarted: payload.gettingStarted,
          planView: payload.planView,
          analysScope: payload.analysScope,
          movementsView: payload.movementsView,
        } satisfies PersistedLastKnown),
      );
    } catch {
      // Quota — next remember retries. Never blank Plan/Analys on purpose.
    }
  }
}

export function clearPersistedLastKnown(): void {
  writeLastHomeCookie(null);
  const storage = persistStorage();
  if (!storage) return;
  try {
    storage.removeItem(LAST_KNOWN_STORAGE_KEY);
  } catch {
    // Ignore storage access errors.
  }
}
