"use server";

import { loadCaptureResume } from "@/features/imports/load-capture-resume";

/** Client Fortsätt — never blocks first Fota chrome. */
export async function getCaptureResumeAction(observationId: string) {
  try {
    return await loadCaptureResume(observationId);
  } catch {
    return null;
  }
}
