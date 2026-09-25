import type { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { isUniqueViolationMessage } from "@/domain/finance";
import {
  BANK_MAIL_OBSERVATION_KIND,
  BANK_MAIL_SOURCE_LABEL,
} from "@/features/imports/bank-mail-label";
import type {
  BankMailAccountGate,
  BankMailPendingInsert,
  BankMailStore,
} from "@/features/imports/bank-mail-ingest";

function isUnique(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return isUniqueViolationMessage(error.message ?? "");
}

/**
 * Service-role writes for the confirmation queue. The caller creates the
 * client (the ingest route). This module never opens a session and never
 * inserts into transactions.
 */
type NumaServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

export function createBankMailStore(supabase: NumaServiceClient): BankMailStore {
  async function findByDedupeKey(
    userId: string,
    keys: {
      messageId: string | null;
      bankReference: string | null;
      fingerprint: string;
    },
  ): Promise<{ observationId: string } | null> {
    if (keys.messageId) {
      const { data, error } = await supabase
        .from("source_observations")
        .select("id")
        .eq("user_id", userId)
        .eq("external_message_id", keys.messageId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data?.id) return { observationId: data.id as string };
    }
    if (keys.bankReference) {
      const { data, error } = await supabase
        .from("source_observations")
        .select("id")
        .eq("user_id", userId)
        .eq("bank_reference", keys.bankReference)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data?.id) return { observationId: data.id as string };
    }
    const { data, error } = await supabase
      .from("extracted_transaction_candidates")
      .select("observation_id")
      .eq("user_id", userId)
      .eq("fingerprint", keys.fingerprint)
      .in("status", ["pending", "needs_review", "confirmed", "duplicate"])
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.observation_id) return { observationId: data.observation_id as string };
    return null;
  }

  return {
    async findAccount(userId, accountId): Promise<BankMailAccountGate> {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, currency, is_active")
        .eq("id", accountId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { ok: false, reason: "missing" };
      if (data.is_active === false) return { ok: false, reason: "inactive" };
      if (data.currency !== "THB") return { ok: false, reason: "currency" };
      return {
        ok: true,
        account: { id: data.id as string, name: (data.name as string) || "Konto" },
      };
    },

    findByDedupeKey,

    async insertPending(row: BankMailPendingInsert) {
      const nowIso = new Date().toISOString();
      const { data: obs, error: obsError } = await supabase
        .from("source_observations")
        .insert({
          user_id: row.userId,
          kind: BANK_MAIL_OBSERVATION_KIND,
          storage_path: null,
          institution_hint: "Bangkok Bank",
          account_hint: row.maskedAccount,
          status: "needs_review",
          notes: row.counterparty,
          external_message_id: row.messageId,
          bank_reference: row.bankReference,
          captured_at: nowIso,
        })
        .select("id")
        .single();

      if (obsError || !obs) {
        if (isUnique(obsError)) {
          const existing = await findByDedupeKey(row.userId, {
            messageId: row.messageId,
            bankReference: row.bankReference,
            fingerprint: row.fingerprint,
          });
          return {
            ok: false as const,
            duplicate: true as const,
            observationId: existing?.observationId ?? null,
          };
        }
        throw new Error(obsError?.message ?? "Kunde inte spara mejlet");
      }

      const observationId = obs.id as string;
      const { data: run, error: runError } = await supabase
        .from("extraction_runs")
        .insert({
          observation_id: observationId,
          user_id: row.userId,
          provider: "bank-mail-parser",
          status: "succeeded",
          raw_metadata: {
            sourceLabel: BANK_MAIL_SOURCE_LABEL,
            messageId: row.messageId,
            referenceNo: row.bankReference,
            importKind: BANK_MAIL_OBSERVATION_KIND,
          },
          finished_at: nowIso,
        })
        .select("id")
        .single();

      if (runError || !run) {
        await supabase.from("source_observations").delete().eq("id", observationId);
        throw new Error(runError?.message ?? "Kunde inte spara läsningen");
      }

      const { data: cand, error: candError } = await supabase
        .from("extracted_transaction_candidates")
        .insert({
          extraction_run_id: run.id,
          observation_id: observationId,
          user_id: row.userId,
          direction: row.direction,
          amount_minor: row.amountMinor,
          currency: row.currency,
          balance_after_minor: null,
          occurred_at: row.occurredAt,
          description: row.counterparty,
          confidence: 0.99,
          fingerprint: row.fingerprint,
          status: "needs_review",
          raw_payload: {
            importKind: BANK_MAIL_OBSERVATION_KIND,
            sourceLabel: BANK_MAIL_SOURCE_LABEL,
            labelSv: row.counterparty,
            counterparty: row.counterparty,
            accountId: row.accountId,
            accountName: row.accountName,
            messageId: row.messageId,
            referenceNo: row.bankReference,
            referenceNo1: row.referenceNo1,
            referenceNo2: row.referenceNo2,
            isWalletTopUp: row.isWalletTopUp,
            payeeCode: row.payeeCode,
            maskedAccount: row.maskedAccount,
            subject: row.subject,
            from: row.from,
            mailDate: row.mailDate,
            batchIndex: 0,
          },
        })
        .select("id")
        .single();

      if (candError || !cand) {
        await supabase.from("source_observations").delete().eq("id", observationId);
        if (isUnique(candError)) {
          return { ok: false as const, duplicate: true as const, observationId: null };
        }
        throw new Error(candError?.message ?? "Kunde inte spara förslaget");
      }

      return {
        ok: true as const,
        observationId,
        candidateId: cand.id as string,
      };
    },
  };
}
