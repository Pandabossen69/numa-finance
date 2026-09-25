import { handleBankMailPost } from "@/features/imports/bank-mail-ingest";
import { createBankMailStore } from "@/features/imports/bank-mail-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Machine ingest for Bangkok Bank notification mail.
 * A later Gmail webhook should call `ingestBankMail` with the same store.
 * The service client is constructed only here.
 */
export async function POST(request: Request) {
  return handleBankMailPost(request, {
    token: process.env.BANK_MAIL_INGEST_TOKEN,
    allowlist: process.env.BANK_MAIL_INGEST_USER_IDS,
    createStore: () => createBankMailStore(createSupabaseServiceRoleClient()),
  });
}
