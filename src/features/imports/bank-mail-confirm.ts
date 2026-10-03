import { after } from "next/server";
import { assertAccountAcceptsWrites, isUniqueViolationMessage } from "@/domain/finance";
import { bankMailConfirmBlockedMessage } from "@/features/imports/bank-mail-notices";
import { fxFieldsForWrite } from "@/lib/store/transaction-fx";
import { mapTransaction } from "@/lib/store/mappers";
import { openingBalanceVerifiedAt } from "@/lib/store/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BANK_MAIL_OBSERVATION_KIND } from "@/features/imports/bank-mail-label";

/**
 * User tap in the confirmation queue. Writes one ledger row from the pending
 * candidate and does not create a balance checkpoint (mail is not a saldo source).
 */
export async function confirmBankMailCandidate(input: {
  observationId: string;
  clientMutationId?: string | null;
  /**
   * Konto from the card already on screen. Lets ägarskap and ingående saldo
   * share the same round as mejlet. The candidate payload still wins if they differ.
   */
  accountId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const hintedAccountId =
    typeof input.accountId === "string" && input.accountId.trim()
      ? input.accountId.trim()
      : null;

  // Cookie session is local. getUser(jwt) verifies with Auth without holding
  // the client lock, so the reads below share that one network round.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Du behöver vara inloggad");

  const userPromise = supabase.auth.getUser(accessToken);
  const obsPromise = supabase
    .from("source_observations")
    .select("id, user_id, kind, status")
    .eq("id", input.observationId)
    .maybeSingle();
  const candPromise = supabase
    .from("extracted_transaction_candidates")
    .select("*")
    .eq("observation_id", input.observationId)
    .in("status", ["needs_review", "confirmed"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const hintedAccountPromise = hintedAccountId
    ? supabase
        .from("accounts")
        .select("id, user_id, currency, is_active")
        .eq("id", hintedAccountId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const hintedOpeningPromise = hintedAccountId
    ? openingBalanceVerifiedAt(hintedAccountId)
    : Promise.resolve(null);

  const [
    {
      data: { user },
    },
    obsResult,
    candResult,
    hintedAccountResult,
    hintedOpening,
  ] = await Promise.all([
    userPromise,
    obsPromise,
    candPromise,
    hintedAccountPromise,
    hintedOpeningPromise,
  ]);
  if (!user) throw new Error("Du behöver vara inloggad");

  const obs = obsResult.data;
  if (obsResult.error) throw new Error(obsResult.error.message);
  if (!obs || obs.user_id !== user.id || obs.kind !== BANK_MAIL_OBSERVATION_KIND) {
    throw new Error("Importen hittades inte");
  }

  const cand = candResult.data;
  if (candResult.error) throw new Error(candResult.error.message);
  if (!cand || cand.user_id !== user.id) throw new Error("Inget att bekräfta");

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

  let account = hintedAccountResult.data;
  let openingBalanceAt = hintedOpening;
  if (hintedAccountResult.error) throw new Error(hintedAccountResult.error.message);
  if (!account || account.id !== accountId || account.user_id !== user.id) {
    const [accountResult, opening] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, user_id, currency, is_active")
        .eq("user_id", user.id)
        .eq("id", accountId)
        .maybeSingle(),
      openingBalanceVerifiedAt(accountId),
    ]);
    if (accountResult.error) throw new Error(accountResult.error.message);
    account = accountResult.data;
    openingBalanceAt = opening;
  }
  const gate = assertAccountAcceptsWrites(
    account ? { isActive: account.is_active !== false } : null,
  );
  if (!gate.ok) throw new Error(gate.error);
  if (!account || account.user_id !== user.id || account.currency !== "THB") {
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
  const blocked = bankMailConfirmBlockedMessage({ occurredAt, openingBalanceAt });
  if (blocked) throw new Error(blocked);
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

  const savedUserId = user.id;
  const savedCandidateId = cand.id as string;
  const savedObservationId = input.observationId;
  const savedTransactionId = transaction.id as string;
  // Queue notes are not the ack. They run after the action response so the
  // toast is one read round plus the insert. A dropped callback leaves the
  // ledger row; the next Importera load still shows the mail.
  after(async () => {
    try {
      const savedAt = new Date().toISOString();
      const [candUpdate, obsUpdate] = await Promise.all([
        supabase
          .from("extracted_transaction_candidates")
          .update({
            status: "confirmed",
            canonical_transaction_id: savedTransactionId,
            updated_at: savedAt,
          })
          .eq("user_id", savedUserId)
          .eq("id", savedCandidateId),
        supabase
          .from("source_observations")
          .update({
            status: "processed",
            notes: "Bekräftad och sparad",
            updated_at: savedAt,
          })
          .eq("user_id", savedUserId)
          .eq("id", savedObservationId),
      ]);
      if (candUpdate.error) throw new Error(candUpdate.error.message);
      if (obsUpdate.error) throw new Error(obsUpdate.error.message);
    } catch (error) {
      console.error("[numa] bank-mail.confirm-ack", error);
    }
  });

  return mapTransaction(transaction);
}

/**
 * Leave the queue without booking. Candidate becomes rejected; the observation
 * becomes processed. Both statuses already exist — no new schema.
 */
export async function rejectBankMailCandidate(input: { observationId: string }) {
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
    .select("id, status")
    .eq("user_id", user.id)
    .eq("observation_id", input.observationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (candError) throw new Error(candError.message);
  if (!cand) throw new Error("Inget att avvisa");
  if (cand.status === "confirmed") {
    throw new Error("Den här betalningen är redan sparad");
  }

  const savedAt = new Date().toISOString();
  if (cand.status !== "rejected") {
    const { error: candUpdateError } = await supabase
      .from("extracted_transaction_candidates")
      .update({ status: "rejected", updated_at: savedAt })
      .eq("user_id", user.id)
      .eq("id", cand.id);
    if (candUpdateError) throw new Error(candUpdateError.message);
  }

  if (obs.status !== "processed") {
    const { error: obsUpdateError } = await supabase
      .from("source_observations")
      .update({
        status: "processed",
        notes: "Avvisad",
        updated_at: savedAt,
      })
      .eq("user_id", user.id)
      .eq("id", input.observationId);
    if (obsUpdateError) throw new Error(obsUpdateError.message);
  }
}
