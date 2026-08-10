"use server";

import { loadHomeSnapshot, type HomeSnapshotResult } from "./load-home";

export type { HomeSnapshot, HomeSnapshotResult } from "./load-home";

/** Client refresh / actions — RSC pages should call `loadHomeSnapshot` directly. */
export async function getHomeSnapshotAction(): Promise<HomeSnapshotResult> {
  return loadHomeSnapshot();
}
