"use client";

import {
  isObservationId,
  parseFotaMode,
  type CaptureMode,
} from "@/features/imports/capture-resume";
import { spaTabKey } from "@/lib/nav/spa-tabs";

export type FotaIntent = {
  mode: CaptureMode;
  observationId: string | null;
};

const EMPTY_INTENT: FotaIntent = { mode: "pick", observationId: null };

let intent: FotaIntent = EMPTY_INTENT;
const listeners = new Set<() => void>();

export function fotaIntentFromHref(href: string): FotaIntent {
  let modeParam: string | null = null;
  let observation: string | null = null;
  try {
    const url = new URL(href, "http://numa.local");
    modeParam = url.searchParams.get("mode");
    observation = url.searchParams.get("observation");
  } catch {
    modeParam = null;
    observation = null;
  }
  return {
    mode: parseFotaMode(modeParam),
    observationId: isObservationId(observation) ? observation : null,
  };
}

export function rememberFotaIntent(next: FotaIntent) {
  if (
    intent.mode === next.mode &&
    intent.observationId === next.observationId
  ) {
    return;
  }
  intent = next;
  for (const listener of listeners) listener();
}

/**
 * SPA keep-alive never remounts Fota, so mode/observation must travel with
 * the href (same pattern as Plan `?steg=`). Non-Fota hrefs are ignored.
 */
export function rememberFotaIntentFromHref(href: string) {
  let path = href;
  try {
    path = new URL(href, "http://numa.local").pathname;
  } catch {
    path = href.split("?")[0] ?? href;
  }
  if (spaTabKey(path) !== "/fota") return;
  rememberFotaIntent(fotaIntentFromHref(href));
}

export function lastFotaIntent(): FotaIntent {
  return intent;
}

export function subscribeFotaIntent(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetFotaIntentForTests() {
  intent = EMPTY_INTENT;
  listeners.clear();
}
