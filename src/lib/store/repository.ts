import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as local from "./local-repository";
import * as remote from "./supabase-repository";
import type { TodaySnapshot } from "./types-snapshot";

export type { TodaySnapshot };

function api() {
  return isSupabaseConfigured() ? remote : local;
}

export async function getProfile() {
  return api().getProfile();
}

export async function listAccounts() {
  return api().listAccounts();
}

export async function getAccount(accountId: string) {
  return api().getAccount(accountId);
}

export async function createAccount(
  input: Parameters<typeof local.createAccount>[0],
) {
  return api().createAccount(input);
}

export async function createCheckpoint(
  input: Parameters<typeof local.createCheckpoint>[0],
) {
  return api().createCheckpoint(input);
}

export async function createManualExpense(
  input: Parameters<typeof local.createManualExpense>[0],
) {
  return api().createManualExpense(input);
}

export async function listTransactions(accountId?: string) {
  return api().listTransactions(accountId);
}

export async function createScreenshotObservation(
  input: Parameters<typeof local.createScreenshotObservation>[0],
) {
  return api().createScreenshotObservation(input);
}

export async function listObservations() {
  return api().listObservations();
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  return api().getTodaySnapshot();
}

export async function getLatestCheckpoint(accountId: string) {
  if (isSupabaseConfigured()) {
    return remote.latestCheckpointForAccount(accountId);
  }
  const store = await import("./local-store").then((m) => m.readStore());
  return local.latestCheckpointForAccount(store, accountId);
}

export { hoursSince } from "./local-repository";
