"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FotaScreen } from "@/components/capture/FotaScreen";
import type { CapturePreview } from "@/features/imports/capture-preview";
import type { CaptureImportKind } from "@/features/imports/capture-resume";
import {
  lastFotaIntent,
  rememberFotaIntentFromHref,
  subscribeFotaIntent,
} from "@/features/imports/fota-intent";
import { getCaptureResumeAction } from "@/features/imports/capture-resume-action";
import {
  lastHomeSnapshot,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";

/**
 * Client-first Fota (Rörelser / Konton quiet-load pattern).
 * Paint last-known capture chrome the same tick — never await RSC Flight
 * or a home snapshot action. Resume (Fortsätt) catches up after paint.
 */
export function FotaRouteClient() {
  const intent = useSyncExternalStore(
    subscribeFotaIntent,
    lastFotaIntent,
    lastFotaIntent,
  );
  useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeSnapshot,
    lastHomeSnapshot,
  );
  const [resume, setResume] = useState<{
    observationId: string;
    mode: CaptureImportKind;
    preview: CapturePreview | null;
  } | null>(null);

  useEffect(() => {
    rememberFotaIntentFromHref(
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  useEffect(() => {
    const observationId = intent.observationId;
    if (!observationId) return;
    let cancelled = false;
    void getCaptureResumeAction(observationId).then((result) => {
      if (cancelled || !result) return;
      setResume({ observationId, ...result });
    });
    return () => {
      cancelled = true;
    };
  }, [intent.observationId]);

  const activeResume =
    intent.observationId && resume?.observationId === intent.observationId
      ? resume
      : null;

  return (
    <FotaScreen
      data={null}
      initialMode={activeResume?.mode ?? intent.mode}
      initialPreview={activeResume?.preview ?? null}
      observationId={intent.observationId}
    />
  );
}
