export type CaptureMode =
  | "pick"
  | "bank_sms"
  | "bank_app"
  | "receipt"
  | "manual"
  | "bank_mail";

export type CaptureImportKind = "bank_sms" | "bank_app" | "receipt" | "bank_mail";

const OBSERVATION_ID = /^[0-9a-f-]{36}$/i;

export function isObservationId(
  value: string | undefined | null,
): value is string {
  return Boolean(value && OBSERVATION_ID.test(value));
}

export function parseFotaMode(modeParam?: string | null): CaptureMode {
  if (modeParam === "bank_mail") return "bank_mail";
  if (modeParam === "sms" || modeParam === "bank_sms") return "bank_sms";
  if (
    modeParam === "bank_app" ||
    modeParam === "bunq" ||
    modeParam === "revolut"
  ) {
    return "bank_app";
  }
  if (modeParam === "kvitto" || modeParam === "receipt") return "receipt";
  if (modeParam === "manual") return "manual";
  return "pick";
}

const PAYLOAD_IMPORT_KINDS = new Set(["bank_sms", "bank_app", "receipt"]);

/** Stored candidate tag (`raw_payload.importKind`) beats the institution name. */
export function payloadImportKind(
  candidates: Array<{ rawPayload?: Record<string, unknown> | null }>,
): "bank_sms" | "bank_app" | "receipt" | null {
  for (const candidate of candidates) {
    const kind = candidate.rawPayload?.importKind;
    if (typeof kind === "string" && PAYLOAD_IMPORT_KINDS.has(kind)) {
      return kind as "bank_sms" | "bank_app" | "receipt";
    }
  }
  return null;
}

function isBankAppHint(hint: string): boolean {
  if (!hint) return false;
  if (hint.includes("bank_app") || hint.includes("bunq") || hint.includes("revolut")) {
    return true;
  }
  return hint.replace(/[\s_-]+/g, "") === "bankapp";
}

export function modeForObservation(input: {
  kind: string;
  institutionHint?: string | null;
}): CaptureImportKind {
  if (input.kind === "bank_mail") return "bank_mail";
  const hint = (input.institutionHint ?? "").trim().toLowerCase();
  if (isBankAppHint(hint)) return "bank_app";
  if (input.kind === "receipt" || input.kind === "price") {
    return "receipt";
  }
  return "bank_sms";
}

/**
 * Fortsätt (needs_review) keeps the observation id so /fota can restore
 * type + image + OCR candidates. Fota igen (failed) opens the matching
 * camera without the stale observation.
 */
export function fotaHrefForObservation(input: {
  id: string;
  kind: string;
  status: string;
  institutionHint?: string | null;
}): string {
  const mode = modeForObservation(input);
  const resume =
    input.status === "needs_review" ||
    input.status === "uploaded" ||
    input.status === "extracting";
  if (resume && isObservationId(input.id)) {
    return `/fota?mode=${mode}&observation=${encodeURIComponent(input.id)}`;
  }
  return `/fota?mode=${mode}`;
}
