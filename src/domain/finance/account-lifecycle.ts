import {
  ACCOUNT_KIND_LABEL_SV,
  assertCurrencyAllowedForKind,
  currenciesForAccountKind,
  type AccountKind,
} from "./account-kind";
import type { Account } from "./types";
import type { CurrencyCode } from "@/domain/money";

export const ACCOUNT_NOT_FOUND_SV = "Kontot hittades inte";
export const ACCOUNT_NOT_OWNED_SV = "Kontot hittades inte";
export const LAST_ACTIVE_ACCOUNT_SV =
  "Minst ett aktivt konto måste finnas. Skapa eller återställ ett annat konto först.";
export const DEFAULT_ACCOUNT_BLOCK_SV =
  "Förvalt konto kan inte arkiveras eller raderas innan du valt ett annat.";
export const HAS_HISTORY_DELETE_SV =
  "Kontot har historik och kan inte raderas. Arkivera det i stället.";
export const ARCHIVE_REQUIRES_HISTORY_SV =
  "Kontot har ingen historik. Radera det i stället.";
export const ARCHIVE_REQUIRES_ZERO_SV =
  "Saldo måste vara 0 innan du arkiverar. Flytta eller töm pengarna först — till exempel med en överföring eller Uppdatera saldo.";
export const ARCHIVE_UNKNOWN_SALDO_SV =
  "Uppdatera saldot till 0 innan du arkiverar. Flytta eller töm pengarna först.";
export const DELETE_REQUIRES_ZERO_SV =
  "Saldo måste vara 0 innan du raderar. Flytta eller töm pengarna först — till exempel med en överföring eller Uppdatera saldo.";
export const DELETE_UNKNOWN_SALDO_SV =
  "Uppdatera saldot till 0 innan du raderar. Flytta eller töm pengarna först.";
export const CHOOSE_OTHER_DEFAULT_SV =
  "Välj ett annat förvalt konto först.";
export const CURRENCY_LOCKED_SV =
  "Valutan är låst eftersom kontot har transaktioner. Historisk växelkurs och THB-värde behålls.";
export const ARCHIVED_NO_NEW_TX_SV =
  "Arkiverade konton kan inte användas för nya transaktioner.";
export const ALREADY_ARCHIVED_SV = "Kontot är redan arkiverat.";
export const NOT_ARCHIVED_SV = "Kontot är inte arkiverat.";
export const DEFAULT_ACCOUNT_COPY_SV = "Förvalt konto för nya utgifter";
export const DEFAULT_ACCOUNT_HELP_SV =
  "Alla konton räknas fortfarande ihop på Hem. Detta väljer bara vilket konto som föreslås när en utgift skapas.";

export type AccountLifecycleFacts = {
  ownerUserId: string;
  actorUserId: string;
  isActive: boolean;
  isDefault: boolean;
  activeCount: number;
  hasLedgerHistory: boolean;
  /** Native calculated balance. Null = unknown. */
  balanceMinor: number | null;
};

export type LifecycleDecision = { ok: true } | { ok: false; error: string };

export function requireLifecycle(decision: LifecycleDecision): void {
  if (!decision.ok) throw new Error(decision.error);
}

export function accountHasLedgerHistory(
  transactions: ReadonlyArray<{ status: string }>,
): boolean {
  return transactions.some((tx) => tx.status !== "voided");
}

export function assertAccountOwned(
  ownerUserId: string,
  actorUserId: string,
): LifecycleDecision {
  if (!ownerUserId || !actorUserId || ownerUserId !== actorUserId) {
    return { ok: false, error: ACCOUNT_NOT_OWNED_SV };
  }
  return { ok: true };
}

export function assertAccountAcceptsWrites(
  account: Pick<Account, "isActive"> | null,
): LifecycleDecision {
  if (!account) return { ok: false, error: ACCOUNT_NOT_FOUND_SV };
  if (!account.isActive) return { ok: false, error: ARCHIVED_NO_NEW_TX_SV };
  return { ok: true };
}

function assertCanRetire(facts: AccountLifecycleFacts): LifecycleDecision {
  const owned = assertAccountOwned(facts.ownerUserId, facts.actorUserId);
  if (!owned.ok) return owned;
  if (!facts.isActive) return { ok: false, error: ALREADY_ARCHIVED_SV };
  if (facts.isDefault) return { ok: false, error: DEFAULT_ACCOUNT_BLOCK_SV };
  if (facts.activeCount <= 1) {
    return { ok: false, error: LAST_ACTIVE_ACCOUNT_SV };
  }
  return { ok: true };
}

/** Empty (no ledger rows) accounts may be hard-deleted only at saldo 0. */
export function evaluateDeleteAccount(
  facts: AccountLifecycleFacts,
): LifecycleDecision {
  const retire = assertCanRetire(facts);
  if (!retire.ok) return retire;
  if (facts.hasLedgerHistory) {
    return { ok: false, error: HAS_HISTORY_DELETE_SV };
  }
  if (facts.balanceMinor == null) {
    return { ok: false, error: DELETE_UNKNOWN_SALDO_SV };
  }
  if (facts.balanceMinor !== 0) {
    return { ok: false, error: DELETE_REQUIRES_ZERO_SV };
  }
  return { ok: true };
}

/** Accounts with history must be archived at saldo 0 — never hard-deleted. */
export function evaluateArchiveAccount(
  facts: AccountLifecycleFacts,
): LifecycleDecision {
  const retire = assertCanRetire(facts);
  if (!retire.ok) return retire;
  if (!facts.hasLedgerHistory) {
    return { ok: false, error: ARCHIVE_REQUIRES_HISTORY_SV };
  }
  if (facts.balanceMinor == null) {
    return { ok: false, error: ARCHIVE_UNKNOWN_SALDO_SV };
  }
  if (facts.balanceMinor !== 0) {
    return { ok: false, error: ARCHIVE_REQUIRES_ZERO_SV };
  }
  return { ok: true };
}

export function evaluateRestoreAccount(
  facts: Pick<AccountLifecycleFacts, "ownerUserId" | "actorUserId" | "isActive">,
): LifecycleDecision {
  const owned = assertAccountOwned(facts.ownerUserId, facts.actorUserId);
  if (!owned.ok) return owned;
  if (facts.isActive) return { ok: false, error: NOT_ARCHIVED_SV };
  return { ok: true };
}

export function evaluateCurrencyChange(
  facts: Pick<
    AccountLifecycleFacts,
    "ownerUserId" | "actorUserId" | "hasLedgerHistory"
  >,
  kind: AccountKind,
  currency: CurrencyCode,
): LifecycleDecision {
  const owned = assertAccountOwned(facts.ownerUserId, facts.actorUserId);
  if (!owned.ok) return owned;
  if (facts.hasLedgerHistory) {
    return { ok: false, error: CURRENCY_LOCKED_SV };
  }
  try {
    assertCurrencyAllowedForKind(kind, currency);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : CURRENCY_LOCKED_SV,
    };
  }
  return { ok: true };
}

export function evaluateKindChange(
  facts: Pick<
    AccountLifecycleFacts,
    "ownerUserId" | "actorUserId" | "hasLedgerHistory"
  >,
  nextKind: AccountKind,
  currency: CurrencyCode,
): LifecycleDecision {
  const owned = assertAccountOwned(facts.ownerUserId, facts.actorUserId);
  if (!owned.ok) return owned;
  const allowed = currenciesForAccountKind(nextKind);
  if (allowed.includes(currency)) return { ok: true };
  if (facts.hasLedgerHistory) {
    return {
      ok: false,
      error: `${ACCOUNT_KIND_LABEL_SV[nextKind]} kräver ${allowed.join(", ")}. ${CURRENCY_LOCKED_SV}`,
    };
  }
  return { ok: true };
}

export function accountTypeForKind(
  kind: AccountKind,
  previous: Account["accountType"],
): Account["accountType"] {
  if (kind === "cash") return "cash";
  return previous === "cash" ? "checking" : previous;
}
