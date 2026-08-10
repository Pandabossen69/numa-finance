"use server";

import {
  loadMovementsSnapshot,
  type MovementsSnapshotResult,
} from "./load-movements";

export type {
  MovementsSnapshot,
  MovementsSnapshotResult,
  MovementRow,
  CategoryTotal,
} from "./load-movements";

export async function getMovementsSnapshotAction(): Promise<MovementsSnapshotResult> {
  return loadMovementsSnapshot();
}
