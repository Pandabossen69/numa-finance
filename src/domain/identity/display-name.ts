export const PLACEHOLDER_DISPLAY_NAME = "Användare";

const KNOWN_DISPLAY_NAMES: Record<string, string> = {
  "qualityltf@gmail.com": "Hugo",
  "kliv.arne@icloud.com": "Jordan",
  "oslin002@gmail.com": "Oscar",
};

export function knownDisplayNameForEmail(
  email: string | null | undefined,
): string | null {
  if (!email) return null;
  return KNOWN_DISPLAY_NAMES[email.trim().toLowerCase()] ?? null;
}

export function isPlaceholderDisplayName(
  name: string | null | undefined,
): boolean {
  const trimmed = name?.trim() ?? "";
  return trimmed.length === 0 || trimmed === PLACEHOLDER_DISPLAY_NAME;
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

export type ResolveDisplayNameInput = {
  stored: string | null | undefined;
  email?: string | null;
  authMetaName?: string | null;
};

/**
 * `profiles.display_name` is the source of truth.
 * The hardcoded email map and auth metadata may seed ONLY a placeholder.
 * Never derive a name from the email local-part.
 */
export function resolveProfileDisplayName(
  input: ResolveDisplayNameInput,
): string {
  const stored = input.stored?.trim() ?? "";
  if (!isPlaceholderDisplayName(stored) && !looksLikeEmail(stored)) {
    return stored;
  }

  const mapped = knownDisplayNameForEmail(input.email);
  if (mapped) return mapped;

  const meta = input.authMetaName?.trim() ?? "";
  if (meta && !isPlaceholderDisplayName(meta) && !looksLikeEmail(meta)) {
    return meta;
  }

  return PLACEHOLDER_DISPLAY_NAME;
}

/** First token for greetings. Never email local-part or "Användare". */
export function greetingFirstName(
  displayName: string | null | undefined,
): string | null {
  const trimmed = displayName?.trim() ?? "";
  if (isPlaceholderDisplayName(trimmed) || looksLikeEmail(trimmed)) return null;
  const first = trimmed.split(/\s+/)[0] ?? "";
  return first || null;
}

/** Full name for chrome. Null means do not paint a name. */
export function chromeDisplayName(
  displayName: string | null | undefined,
): string | null {
  const trimmed = displayName?.trim() ?? "";
  if (isPlaceholderDisplayName(trimmed) || looksLikeEmail(trimmed)) return null;
  return trimmed;
}
