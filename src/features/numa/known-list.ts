/**
 * Unknown (null/undefined) is not an empty list. Callers must keep the
 * skeleton until the server has answered, and only then render [].
 */
export function knownList<T>(
  value: readonly T[] | null | undefined,
): T[] | null {
  if (value == null) return null;
  return value as T[];
}
