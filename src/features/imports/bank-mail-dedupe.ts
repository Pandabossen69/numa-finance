/**
 * Fingerprints that mean this mail is already a booked ledger row.
 * The mail fingerprint is `bbl-mail:ref:<reference>` when the bank sent a
 * reference. A row that stored the reference itself counts too.
 */
export function bankMailDedupeFingerprints(keys: {
  bankReference: string | null;
  fingerprint: string;
}): string[] {
  const values = new Set<string>();
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) values.add(trimmed);
  };
  add(keys.fingerprint);
  const reference = keys.bankReference?.trim();
  if (reference) {
    add(reference);
    add(`bbl-mail:ref:${reference}`);
  }
  return [...values];
}

/** Only `voided` is a soft delete. Every other status still occupies the ref. */
export function transactionStatusBlocksBankMail(
  status: string | null | undefined,
): boolean {
  return (status ?? "").trim().toLowerCase() !== "voided";
}
