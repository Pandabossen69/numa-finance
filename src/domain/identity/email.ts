export const EMAIL_REQUIRED_MESSAGE = "Ange din e-postadress";
export const EMAIL_INVALID_MESSAGE = "Ange en giltig e-postadress";

/** HTML5-ish: local-part @ domain, no spaces. */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+$/;

export function isPlausibleEmail(value: string): boolean {
  return PLAUSIBLE_EMAIL.test(value.trim());
}

export function swedishEmailConstraintMessage(
  validity: Pick<ValidityState, "valueMissing" | "typeMismatch">,
): string {
  if (validity.valueMissing) return EMAIL_REQUIRED_MESSAGE;
  if (validity.typeMismatch) return EMAIL_INVALID_MESSAGE;
  return "";
}
