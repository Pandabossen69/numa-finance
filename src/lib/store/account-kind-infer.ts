import type { AccountKind, AccountType } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

/** Best-effort kind when caller did not pick one (bank-SMS, ensureDefault, …). */
export function inferAccountKind(input: {
  kind?: AccountKind | null;
  accountType: AccountType;
  currency: CurrencyCode;
  name?: string | null;
  institution?: string | null;
}): AccountKind {
  if (input.kind) return input.kind;
  if (input.accountType === "cash") return "cash";
  const label = `${input.institution ?? ""} ${input.name ?? ""}`.toLowerCase();
  if (label.includes("revolut")) return "revolut";
  if (label.includes("bunq")) return "bunq";
  if (input.currency === "THB") return "thai_bank";
  if (input.currency === "SEK") return "swedish_bank";
  return "other";
}
