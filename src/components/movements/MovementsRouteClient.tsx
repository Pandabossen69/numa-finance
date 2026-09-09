"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MovementsScreen } from "@/components/movements/MovementsScreen";
import { getMovementsSnapshotAction } from "@/features/finance/movements-snapshot";
import {
  isMovementsDirty,
  lastMovementsSnapshot,
  rememberMovementsSnapshot,
  subscribeMovementsSnapshot,
} from "@/features/home/last-snapshot";

/**
 * Client-first Rörelser (NextStep quiet-load pattern).
 * Paint last-known immediately; fetch in the background. Failures never clear
 * a painted list — that was the 10s Analys→Transaktioner skeleton stall.
 */
export function MovementsRouteClient() {
  const stored = useSyncExternalStore(
    subscribeMovementsSnapshot,
    lastMovementsSnapshot,
    lastMovementsSnapshot,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMovementsSnapshotAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        if (!isMovementsDirty()) rememberMovementsSnapshot(result.data);
        setError(null);
        return;
      }
      // Quiet failure: only surface an error when there is nothing to show.
      if (!lastMovementsSnapshot()) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <MovementsScreen data={stored} error={error} />;
}
