import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import {
  isObservationId,
  parseFotaMode,
} from "@/features/imports/capture-resume";
import { loadCaptureResume } from "@/features/imports/load-capture-resume";
import {
  getCachedTodaySnapshot,
  loadHomeSnapshot,
} from "@/features/finance/load-home";

export default async function FotaPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; observation?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const modeParam = params.mode;
  const observationId = isObservationId(params.observation)
    ? params.observation
    : null;
  const parsedMode = parseFotaMode(modeParam);

  const [home, snap, resume] = await Promise.all([
    loadHomeSnapshot(),
    getCachedTodaySnapshot().catch(() => null),
    observationId ? loadCaptureResume(observationId) : Promise.resolve(null),
  ]);
  const data = home.ok ? home.data : null;
  const bootstrapping = Boolean(data && !data.hasBankTruth);

  const initialMode =
    resume?.mode ??
    (modeParam ? parsedMode : bootstrapping ? "bank_sms" : parsedMode);

  const accounts =
    snap?.accounts
      .filter((a) => a.isActive)
      .map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        currency: a.currency,
      })) ?? [];

  const thbAccountId =
    accounts.find((a) => a.currency === "THB" && a.accountType !== "cash")?.id ??
    accounts.find((a) => a.currency === "THB")?.id ??
    null;
  const preferThb = bootstrapping || initialMode === "bank_sms";
  const preferredAccountId =
    (preferThb ? thbAccountId : null) ??
    data?.primaryAccountId ??
    thbAccountId;

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-6">
      {home.ok === false || !data ? (
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Lägg till</h1>
          <p className="text-sm text-[var(--numa-danger)]">
            {home.ok === false ? home.error : "Kunde inte ladda."}
          </p>
          <RetryLoadButton />
        </div>
      ) : (
        <ReceiptCaptureFlow
          key={
            observationId
              ? `obs:${observationId}`
              : `mode:${initialMode}`
          }
          accountId={preferredAccountId}
          accounts={accounts}
          remainingTodayMinor={data.remainingTodayMinor}
          currency={data.currency}
          bootstrapping={bootstrapping}
          initialMode={initialMode}
          initialPreview={resume?.preview ?? null}
        />
      )}
    </div>
  );
}
