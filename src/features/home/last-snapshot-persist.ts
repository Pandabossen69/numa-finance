import { writeLastHomeCookie } from "@/features/home/last-home-cookie";
import { clearBankMailPendingCount } from "@/features/imports/bank-mail-pending-store";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { GettingStartedView } from "@/features/getting-started/progress";
import type {
  MerSnapshot,
  MovementsView,
} from "@/features/home/last-snapshot";

export const LAST_KNOWN_STORAGE_KEY = "numa.lastKnown.v1";

const MAX_MOVEMENT_ITEMS = 50;
const MAX_QUOTA_PLAN_LEDGER = 40;

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
  movementsView: MovementsView | null;
  /** Last «Att bekräfta» count. Omitted on older payloads means unknown. */
  pendingBankMailCount?: number | null;
};

let pendingBankMailCount: number | null = null;
/** Bekräfta or a finished Hem fetch. A later disk rewrite must not replace it. */
let pendingCountAuthoritative = false;

export function rememberedPendingBankMailCount(): number | null {
  return pendingBankMailCount;
}

export function pendingBankMailCountIsAuthoritative(): boolean {
  return pendingCountAuthoritative;
}

export function rememberPendingBankMailCount(count: number | null) {
  if (pendingCountAuthoritative) return;
  if (count == null) {
    pendingBankMailCount = null;
    return;
  }
  if (!Number.isInteger(count) || count < 0) return;
  pendingBankMailCount = count;
}

/** Server or Bekräfta wins over cookie / localStorage for this count. */
export function lockPendingBankMailCount(count: number | null) {
  if (count == null) {
    pendingBankMailCount = null;
  } else if (!Number.isInteger(count) || count < 0) {
    return;
  } else {
    pendingBankMailCount = count;
  }
  pendingCountAuthoritative = true;
}

export function resetRememberedPendingBankMailCountForTests() {
  pendingBankMailCount = null;
  pendingCountAuthoritative = false;
}

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

/** Drop unused Analys lists so quota is less likely to evict the whole page. */
function slimAnalys(snap: AnalysSnapshot | null): AnalysSnapshot | null {
  if (!snap) return null;
  return {
    ...snap,
    goals: [],
    cycle: {
      ...snap.cycle,
      incomes: [],
      expenses: [],
    },
  };
}

/** Quota fallback — keep Plan so Analys can derive instead of a false empty. */
function slimPlanForQuota(snap: PlanSnapshot | null): PlanSnapshot | null {
  if (!snap) return null;
  if (snap.ledgerTransactions.length <= MAX_QUOTA_PLAN_LEDGER) return snap;
  return {
    ...snap,
    ledgerTransactions: snap.ledgerTransactions.slice(0, MAX_QUOTA_PLAN_LEDGER),
  };
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
  const incoming = data.pendingBankMailCount;
  if (!pendingCountAuthoritative && typeof incoming === "number") {
    rememberPendingBankMailCount(incoming);
  }
  const pendingBankMailCount = pendingCountAuthoritative
    ? rememberedPendingBankMailCount()
    : typeof incoming === "number"
      ? incoming
      : rememberedPendingBankMailCount();
  const payload: PersistedLastKnown = {
    ...data,
    v: 1,
    movements: slimMovements(data.movements),
    analys: slimAnalys(data.analys),
    pendingBankMailCount,
  };
  // Cookie must land even when localStorage is unavailable — layout SSR
  // reads numa.lastHome.v1 for first Kvar/Över and the mail cue (SPEC 6b).
  writeLastHomeCookie(payload.home, payload.pendingBankMailCount);
  const storage = persistStorage();
  if (!storage) return;
  try {
    storage.setItem(LAST_KNOWN_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    try {
      storage.setItem(
        LAST_KNOWN_STORAGE_KEY,
        JSON.stringify({
          v: 1,
          userId: payload.userId,
          home: payload.home,
          plan: slimPlanForQuota(payload.plan),
          analys: null,
          mer: payload.mer,
          accounts: payload.accounts,
          movements: null,
          gettingStarted: payload.gettingStarted,
          planView: payload.planView,
          analysScope: payload.analysScope,
          movementsView: payload.movementsView,
          pendingBankMailCount: payload.pendingBankMailCount ?? null,
        } satisfies PersistedLastKnown),
      );
    } catch {
      // Quota — next remember retries.
    }
  }
}

export function clearPersistedLastKnown(): void {
  pendingCountAuthoritative = false;
  pendingBankMailCount = null;
  clearBankMailPendingCount();
  writeLastHomeCookie(null);
  const storage = persistStorage();
  if (!storage) return;
  try {
    storage.removeItem(LAST_KNOWN_STORAGE_KEY);
  } catch {
    // Ignore storage access errors.
  }
}
