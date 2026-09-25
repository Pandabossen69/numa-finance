import {
  getObservation,
  getObservationMediaUrl,
  getProfile,
  listObservationCandidates,
  openingBalanceVerifiedAt,
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

  let openingBalanceAt: string | null = null;
  if (observation.kind === "bank_mail") {
    const accountId = candidates
      .map((candidate) => candidate.rawPayload?.accountId)
      .find((id): id is string => typeof id === "string" && id.length > 0);
    if (accountId) {
      try {
        openingBalanceAt = await openingBalanceVerifiedAt(accountId);
      } catch {
        openingBalanceAt = null;
      }
    }
  }

  return {
    mode: modeForObservation(observation),
    preview: buildCapturePreview({
      observation,
      candidates,
      previewUrl,
      fallbackCurrency: profile.primaryCurrency,
      openingBalanceAt,
    }),
  };
}
