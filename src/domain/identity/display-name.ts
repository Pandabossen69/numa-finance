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
