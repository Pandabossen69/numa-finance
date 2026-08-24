/** Reject if `promise` does not settle within `ms`. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out after \d+ms/.test(error.message);
}

export const LOAD_TIMEOUT_MESSAGE_SV =
  "Det tog för lång tid att hämta din ekonomi. Försök igen.";

/** Map internal timeout errors to a short Swedish line. Keep other errors as-is. */
export function loadErrorMessageSv(error: unknown, fallback: string): string {
  if (isTimeoutError(error)) return LOAD_TIMEOUT_MESSAGE_SV;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
