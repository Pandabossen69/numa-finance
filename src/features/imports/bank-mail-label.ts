/** Visible source in the confirmation queue. Screenshot copy stays untouched. */
export const BANK_MAIL_SOURCE_LABEL = "Bangkok Bank-mejl" as const;

/**
 * Hem's last-known boot names the primary account "Konto" until Konton has
 * loaded. Prefer a real account name, then the name stored with the mail.
 */
export function bankMailAccountLabel(input: {
  liveName?: string | null;
  storedName?: string | null;
}): string {
  const live = input.liveName?.trim();
  if (live && live !== "Konto") return live;
  const stored = input.storedName?.trim();
  if (stored) return stored;
  return live || "Konto";
}

export const BANK_MAIL_OBSERVATION_KIND = "bank_mail" as const;

export const BANK_MAIL_IGNORED_LOG = "[numa] bank-mail ignored";
