import {
  getObservation,
  getObservationMediaUrl,
  getProfile,
  listObservationCandidates,
} from "@/lib/store/repository";
import { buildCapturePreview, type CapturePreview } from "./capture-preview";
import {
  isObservationId,
  modeForObservation,
  type CaptureImportKind,
} from "./capture-resume";

export async function loadCaptureResume(observationId: string): Promise<{
  mode: CaptureImportKind;
  preview: CapturePreview | null;
} | null> {
  if (!isObservationId(observationId)) return null;

  const observation = await getObservation(observationId);
  if (!observation) return null;

  const [candidates, previewUrl, profile] = await Promise.all([
    listObservationCandidates(observation.id),
    observation.storagePath
      ? getObservationMediaUrl(observation.storagePath)
      : Promise.resolve(null),
    getProfile(),
  ]);

  return {
    mode: modeForObservation(observation),
    preview: buildCapturePreview({
      observation,
      candidates,
      previewUrl,
      fallbackCurrency: profile.primaryCurrency,
    }),
  };
}
