import { cache } from "react";
import { getTodaySnapshot as loadTodaySnapshot } from "@/lib/store/repository";
import { withTimeout } from "@/lib/store/with-timeout";

const SNAPSHOT_TIMEOUT_MS = 8_000;

/**
 * One snapshot per request — shared by pages.
 * Hard timeout so a hung Supabase call cannot blank the UI forever.
 */
export const getTodaySnapshotCached = cache(async () =>
  withTimeout(loadTodaySnapshot(), SNAPSHOT_TIMEOUT_MS, "getTodaySnapshot"),
);
