import { getPlanPageDataAction } from "@/components/plan/load-plan";
import { getAnalysSnapshotAction } from "@/features/finance/analys-snapshot";
import { loadAccountsSnapshot } from "@/features/finance/load-accounts";
import { loadHomeSnapshot } from "@/features/finance/load-home";
import { loadMovementsSnapshot } from "@/features/finance/load-movements";
import { getMerSnapshotAction } from "@/features/finance/mer-snapshot";
import { getQuietMenuBundleAction } from "@/features/finance/quiet-menu-bundle";
import { loadImporteraRows } from "@/features/imports/load-importera-rows";
import { countPendingBankMail } from "@/features/imports/pending-bank-mail-count";
import type { NumaReadPart } from "@/lib/numa/read-client";
import { getAuthUser } from "@/lib/supabase/auth-user";

export const dynamic = "force-dynamic";

const PARTS = new Set<NumaReadPart>([
  "home",
  "importera",
  "plan",
  "mer",
  "movements",
  "accounts",
  "analys",
  "quiet",
  "pending",
]);

function isPart(value: string | null): value is NumaReadPart {
  return value != null && PARTS.has(value as NumaReadPart);
}

const READ_FAILED_SV = "Kunde inte hämta just nu.";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isFailedRead(body: unknown): body is { ok: false; error?: unknown } {
  return (
    body != null &&
    typeof body === "object" &&
    "ok" in body &&
    (body as { ok: unknown }).ok === false
  );
}

/**
 * Parallel cold-start reads. Auth is the Supabase session cookie.
 * Loaders take user id from that session (`requireUserId`), never from
 * the query string.
 */
export async function GET(request: Request) {
  const part = new URL(request.url).searchParams.get("part");
  if (!isPart(part)) {
    return json({ ok: false, error: "Okänd läsning" }, 400);
  }

  const user = await getAuthUser();
  if (!user) {
    return json({ ok: false, error: "Du måste vara inloggad" }, 401);
  }

  try {
    const body = await loadPart(part);
    if (isFailedRead(body)) {
      console.error("[numa] read", part, body.error);
      return json({ ok: false, error: READ_FAILED_SV });
    }
    return json(body);
  } catch (error) {
    console.error("[numa] read", part, error);
    return json({ ok: false, error: READ_FAILED_SV }, 500);
  }
}

async function loadPart(part: NumaReadPart) {
  switch (part) {
    case "home": {
      const [home, pendingBankMailCount] = await Promise.all([
        loadHomeSnapshot(),
        countPendingBankMail(),
      ]);
      if (!home.ok) return home;
      return { ...home, pendingBankMailCount };
    }
    case "importera":
      return { ok: true as const, data: await loadImporteraRows() };
    case "plan":
      return getPlanPageDataAction();
    case "mer":
      return getMerSnapshotAction();
    case "movements":
      return loadMovementsSnapshot();
    case "accounts":
      return loadAccountsSnapshot();
    case "analys":
      return getAnalysSnapshotAction();
    case "quiet":
      return getQuietMenuBundleAction();
    case "pending":
      return { ok: true as const, count: await countPendingBankMail() };
  }
}
