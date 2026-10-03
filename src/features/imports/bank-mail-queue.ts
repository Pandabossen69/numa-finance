export function bankMailConfirmHeading(count: number): string {
  return `Att bekräfta (${count})`;
}

export function isPendingBankMail(row: {
  kind: string;
  status: string;
}): boolean {
  return row.kind === "bank_mail" && row.status === "needs_review";
}

/** Suggestions leave the picture list. Saved mails and screenshots stay. */
export function splitImporteraRows<T extends { kind: string; status: string }>(
  rows: T[],
): { pendingMail: T[]; rest: T[] } {
  const pendingMail: T[] = [];
  const rest: T[] = [];
  for (const row of rows) {
    if (isPendingBankMail(row)) pendingMail.push(row);
    else rest.push(row);
  }
  return { pendingMail, rest };
}
