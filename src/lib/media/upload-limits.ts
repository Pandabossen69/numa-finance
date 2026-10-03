/**
 * Server Actions default to a 1 MB body. Vercel rejects the whole request
 * above 4.5 MB, so the client must land under that even when the action
 * limit is higher. 12 MB is only a safety net for the action parser.
 */
export const SERVER_ACTION_BODY_LIMIT = "12mb";

/** Stay under Vercel's 4.5 MB platform cap, including multipart overhead. */
export const CLIENT_UPLOAD_BUDGET_BYTES = 4_000_000;

export const SERVER_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

export const TEXT_MAX_EDGE = 2400;
export const PHOTO_MAX_EDGE = 2000;
export const UPLOAD_JPEG_QUALITY = 0.85;

export const IMAGE_TOO_BIG_SV =
  "Bilden är för stor. Prova en skärmdump eller en mindre bild.";

export const IMAGE_UNREADABLE_SV =
  "Bilden kunde inte läsas. Prova en skärmdump eller en mindre bild.";

/** Never upscale. Longest side above maxEdge is scaled down to fit. */
export function downscaleFactor(longest: number, maxEdge: number): number {
  if (!Number.isFinite(longest) || longest <= 0 || longest <= maxEdge) return 1;
  return maxEdge / longest;
}
