type AccountWriteResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/**
 * One in-flight create per clientMutationId.
 *
 * useSubmitGuard closes the double-tap on the button. This map is the second
 * line: Enter and click, or a retry that races the first request, share one
 * promise and therefore one create. The id stays the caller's job so a failed
 * attempt can retry with the same id after this promise settles.
 *
 * numa.accounts has no client_mutation_id column, so this cannot be an
 * upsert yet. See the PR note for the migration NUMA Data would apply.
 */
const inFlight = new Map<string, Promise<AccountWriteResult>>();

export function createAccountOnce<T extends { clientMutationId?: string }>(
  input: T,
  write: (input: T) => Promise<AccountWriteResult>,
): Promise<AccountWriteResult> {
  const id = input.clientMutationId;
  if (!id) return write(input);
  const pending = inFlight.get(id);
  if (pending) return pending;
  const promise = write(input).finally(() => {
    if (inFlight.get(id) === promise) inFlight.delete(id);
  });
  inFlight.set(id, promise);
  return promise;
}

export function resetCreateAccountOnceForTests(): void {
  inFlight.clear();
}
