/** Shown when a save never reached the server. */
export const OFFLINE_SAVE_MESSAGE_SV = "Ingen anslutning. Inget sparades.";

const NETWORK_TEXT = /failed to fetch|networkerror|load failed/i;

function rawMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "";
}

/**
 * True for a fetch that never got a response: Chrome `TypeError: Failed to fetch`,
 * Firefox `NetworkError`, Safari `Load failed`, or the browser already offline.
 */
export function isOfflineSaveError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = rawMessage(error);
  if (NETWORK_TEXT.test(message)) return true;
  return error instanceof TypeError && NETWORK_TEXT.test(message);
}

/** Swedish line for a network failure, or null when the error is something else. */
export function offlineSaveMessage(error: unknown): string | null {
  return isOfflineSaveError(error) ? OFFLINE_SAVE_MESSAGE_SV : null;
}

/** Network failures become the shared Swedish line. Everything else keeps its text. */
export function userFacingSaveError(error: unknown, fallback: string): string {
  const offline = offlineSaveMessage(error);
  if (offline) return offline;
  const message = rawMessage(error).trim();
  return message || fallback;
}
