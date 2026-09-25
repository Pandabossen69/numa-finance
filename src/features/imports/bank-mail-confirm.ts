import { assertAccountAcceptsWrites, isUniqueViolationMessage } from "@/domain/finance";
import { fxFieldsForWrite } from "@/lib/store/transaction-fx";
import { mapTransaction } from "@/lib/store/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BANK_MAIL_OBSERVATION_KIND } from "@/features/imports/bank-mail-label";

/**
 * User tap in the confirmation queue. Writes one ledger row from the pending
 * candidate and does not create a balance checkpoint (mail is not a saldo source).
 */
export async function confirmBankMailCandidate(input: {
  observationId: string;
  clientMutationId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Du behöver vara inloggad");

  const { data: obs, error: obsError } = await supabase
    .from("source_observations")
    .select("id, kind, status")
    .eq("user_id", user.id)
    .eq("id", input.observationId)
    .maybeSingle();
  if (obsError) throw new Error(obsError.message);
  if (!obs || obs.kind !== BANK_MAIL_OBSERVATION_KIND) {
    throw new Error("Importen hittades inte");
  }

  const { data: cand, error: candError } = await supabase
    .from("extracted_transaction_candidates")
    .select("*")
    .eq("user_id", user.id)
    .eq("observation_id", input.observationId)
    .in("status", ["needs_review", "confirmed"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (candError) throw new Error(candError.message);
  if (!cand) throw new Error("Inget att bekräfta");

  if (cand.status === "confirmed" && cand.canonical_transaction_id) {
    const { data: existing, error: existingError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", cand.canonical_transaction_id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return mapTransaction(existing);
  }

  const payload = (cand.raw_payload ?? {}) as Record<string, unknown>;
  const accountId = typeof payload.accountId === "string" ? payload.accountId : null;
  if (!accountId) throw new Error("Kontot saknas på mejlet");

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, currency, is_active")
    .eq("user_id", user.id)
    .eq("id", accountId)
    .maybeSingle();
  if (accountError) throw new Error(accountError.message);
  const gate = assertAccountAcceptsWrites(
    account ? { isActive: account.is_active !== false } : null,
  );
  if (!gate.ok) throw new Error(gate.error);
  if (!account || account.currency !== "THB") {
    throw new Error("Bangkok Bank-mejl bokförs på THB-kontot mejlet hör till");
  }

  const amountMinor = Number(cand.amount_minor);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error("Beloppet saknas");
  }
  const direction = cand.direction === "credit" ? "credit" : "debit";
  const counterparty =
    (typeof payload.counterparty === "string" && payload.counterparty.trim()) ||
    (typeof cand.description === "string" && cand.description.trim()) ||
    "Bangkok Bank";
  const occurredAt =
    typeof cand.occurred_at === "string" && cand.occurred_at
      ? cand.occurred_at
      : new Date().toISOString();
  const nowIso = new Date().toISOString();
  const fx = fxFieldsForWrite({
    nativeMinor: amountMinor,
    currency: "THB",
    checkpoint: null,
    nowIso,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: account.id,
      direction,
      transaction_type: direction === "credit" ? "income" : "expense",
      amount_minor: amountMinor,
      currency: "THB",
      thb_minor: fx.thbMinor,
      fx_rate: fx.fxRate,
      fx_as_of: fx.fxAsOf,
      fx_source: fx.fxSource,
      client_mutation_id: input.clientMutationId ?? null,
      occurred_at: occurredAt,
      description: counterparty,
      merchant: counterparty,
      category: null,
      source: "bank_import",
      status: "confirmed",
      sync_status: "synced",
      source_observation_id: input.observationId,
      fingerprint: cand.fingerprint,
      balance_after_minor: null,
      ledger_origin: "external",
    })
    .select("*")
    .single();

  let transaction = inserted;
  if (insertError) {
    if (!isUniqueViolationMessage(insertError.message) || !cand.fingerprint) {
      throw new Error(insertError.message);
    }
    const { data: raced, error: racedError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("fingerprint", cand.fingerprint)
      .neq("status", "voided")
      .limit(1)
      .maybeSingle();
    if (racedError) throw new Error(racedError.message);
    if (!raced) throw new Error(insertError.message);
    transaction = raced;
  }
  if (!transaction) throw new Error("Kunde inte spara betalningen");

  const savedAt = new Date().toISOString();
  const { error: candUpdateError } = await supabase
    .from("extracted_transaction_candidates")
    .update({
      status: "confirmed",
      canonical_transaction_id: transaction.id,
      updated_at: savedAt,
    })
    .eq("user_id", user.id)
    .eq("id", cand.id);
  if (candUpdateError) throw new Error(candUpdateError.message);

  const { error: obsUpdateError } = await supabase
    .from("source_observations")
    .update({
      status: "processed",
      notes: "Bekräftad och sparad",
      updated_at: savedAt,
    })
    .eq("user_id", user.id)
    .eq("id", input.observationId);
  if (obsUpdateError) throw new Error(obsUpdateError.message);

  return mapTransaction(transaction);
}
