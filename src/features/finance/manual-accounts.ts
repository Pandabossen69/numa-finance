export type ShellAccount = {
  id: string;
  name: string;
  accountType: string;
  currency?: string;
  fxRate?: number | null;
  kind?: string;
};

export type ManualAccountSource = {
  id: string;
  name: string;
  currency?: string;
  accountType?: string;
  kind?: string;
  fxRate?: number | null;
  isActive?: boolean;
};

/** Cash is a kind. Older rows also store it as accountType. */
export function isCashAccount(account: {
  accountType?: string;
  kind?: string;
}): boolean {
  return account.kind === "cash" || account.accountType === "cash";
}

function toShell(row: ManualAccountSource): ShellAccount {
  return {
    id: row.id,
    name: row.name.trim() || "Konto",
    accountType: isCashAccount(row) ? "cash" : row.accountType || "checking",
    currency: row.currency,
    fxRate: row.fxRate ?? null,
    kind: row.kind,
  };
}

/**
 * Accounts for Fota → Manuellt.
 *
 * Hem and kvittogranskning read the Konton snapshot (`lastAccountsSnapshot`).
 * The Fota boot fallback is a single stub named «Konto» until that snapshot
 * arrives, so known active rows replace the stub as soon as they exist.
 */
export function manualAccountsFromSources(input: {
  shell?: readonly ManualAccountSource[] | null;
  known?: readonly ManualAccountSource[] | null;
}): ShellAccount[] {
  const knownActive = (input.known ?? []).filter(
    (row) => row.isActive !== false && row.id,
  );
  const source = knownActive.length > 0 ? knownActive : (input.shell ?? []);
  const seen = new Set<string>();
  const accounts: ShellAccount[] = [];
  for (const row of source) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    accounts.push(toShell(row));
  }
  return accounts;
}

/** Keep a chosen id when it is still in the list; otherwise the first option. */
export function resolveListedAccountId(
  current: string,
  options: readonly { id: string }[],
  fallback = "",
): string {
  if (current && options.some((row) => row.id === current)) return current;
  if (fallback && options.some((row) => row.id === fallback)) return fallback;
  return options[0]?.id ?? "";
}
