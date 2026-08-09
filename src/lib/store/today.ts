import { cache } from "react";
import { getTodaySnapshot as loadTodaySnapshot } from "@/lib/store/repository";

/**
 * One snapshot per request — shared by AppShell + Idag/Plan/Analys.
 * Avoids duplicate Supabase round-trips and inconsistent shell/page state.
 */
export const getTodaySnapshotCached = cache(async () => loadTodaySnapshot());
