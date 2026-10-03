import type { AccountsSnapshotResult } from "@/features/finance/load-accounts";
import type { AnalysSnapshotResult } from "@/features/finance/load-analys";
import type { HomeSnapshotResult } from "@/features/finance/load-home";
import type { MovementsSnapshotResult } from "@/features/finance/load-movements";
import type { QuietMenuBundleResult } from "@/features/finance/quiet-menu-bundle";
import type { MerSnapshotResult } from "@/features/finance/mer-snapshot";
import type { PlanPageDataResult } from "@/components/plan/load-plan";
import type { ImporteraRow } from "@/features/home/last-snapshot";

/**
 * Pure reads go through GET so they run in parallel and stay off Next's
 * one-at-a-time server-action queue. Writes keep that queue for themselves.
 */
export type NumaReadPart =
  | "home"
  | "importera"
  | "plan"
  | "mer"
  | "movements"
  | "accounts"
  | "analys"
  | "quiet"
  | "pending";

export type HomeReadResult =
  | (Extract<HomeSnapshotResult, { ok: true }> & {
      pendingBankMailCount: number;
    })
  | Extract<HomeSnapshotResult, { ok: false }>;

export type ImporteraReadResult =
  | { ok: true; data: ImporteraRow[] }
  | { ok: false; error: string };

export type PendingCountReadResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

const NO_STORE: RequestInit = {
  method: "GET",
  credentials: "same-origin",
  cache: "no-store",
  headers: { accept: "application/json" },
};

export async function readNuma<T>(part: NumaReadPart): Promise<T> {
  const response = await fetch(`/api/numa/read?part=${part}`, NO_STORE);
  if (!response.ok) {
    let error = "Kunde inte hämta";
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body.error === "string" && body.error) error = body.error;
    } catch {
      // Keep the generic message.
    }
    throw new Error(error);
  }
  return (await response.json()) as T;
}

export function readHomeSnapshot() {
  return readNuma<HomeReadResult>("home");
}

export function readImporteraRows() {
  return readNuma<ImporteraReadResult>("importera");
}

export function readPlanPageData() {
  return readNuma<PlanPageDataResult>("plan");
}

export function readMerSnapshot() {
  return readNuma<MerSnapshotResult>("mer");
}

export function readMovementsSnapshot() {
  return readNuma<MovementsSnapshotResult>("movements");
}

export function readAccountsSnapshot() {
  return readNuma<AccountsSnapshotResult>("accounts");
}

export function readAnalysSnapshot() {
  return readNuma<AnalysSnapshotResult>("analys");
}

export function readQuietMenuBundle() {
  return readNuma<QuietMenuBundleResult>("quiet");
}

export function readPendingBankMailCount() {
  return readNuma<PendingCountReadResult>("pending");
}
