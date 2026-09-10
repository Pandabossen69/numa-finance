/**
 * One client_mutation_id may live on only one transactions row
 * (`numa_transactions_user_mutation_uidx`). A transfer / cash withdrawal
 * is two rows in one INSERT, so the key sits on the debit and the credit
 * is found via transfer_group_id.
 */
export type PairedMutationRow = {
  id: string;
  direction: string;
  status: string;
  clientMutationId?: string | null;
  transferGroupId: string | null;
};

export type PairedMoneyMove<T extends PairedMutationRow> = {
  out: T;
  inn: T;
};

export function replayPairedMoneyMove<T extends PairedMutationRow>(
  mutationId: string,
  rows: T[],
): PairedMoneyMove<T> | "missing" | "incomplete" {
  const hit = rows.find(
    (row) =>
      row.clientMutationId === mutationId && row.status !== "voided",
  );
  if (!hit) return "missing";
  if (!hit.transferGroupId) return "incomplete";
  const group = rows.filter(
    (row) =>
      row.transferGroupId === hit.transferGroupId && row.status !== "voided",
  );
  const out = group.find((row) => row.direction === "debit");
  const inn = group.find((row) => row.direction === "credit");
  if (!out || !inn) return "incomplete";
  return { out, inn };
}

export function requireCompletePairedReplay<T extends PairedMutationRow>(
  mutationId: string | null | undefined,
  rows: T[],
  incompleteMessage: string,
): PairedMoneyMove<T> | null {
  if (!mutationId) return null;
  const replay = replayPairedMoneyMove(mutationId, rows);
  if (replay === "missing") return null;
  if (replay === "incomplete") {
    throw new Error(incompleteMessage);
  }
  return replay;
}
