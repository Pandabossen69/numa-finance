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
    mode: CaptureImportKind;
    preview: CapturePreview | null;
  } | null>(null);

  useEffect(() => {
    rememberFotaIntentFromHref(
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  useEffect(() => {
    if (!intent.observationId) {
      setResume(null);
      return;
    }
    let cancelled = false;
    void getCaptureResumeAction(intent.observationId).then((result) => {
      if (cancelled) return;
      setResume(result);
    });
    return () => {
      cancelled = true;
    };
  }, [intent.observationId]);

  return (
    <FotaScreen
      data={null}
      initialMode={resume?.mode ?? intent.mode}
      initialPreview={resume?.preview ?? null}
      observationId={intent.observationId}
    />
  );
}
