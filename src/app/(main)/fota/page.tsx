import { Suspense } from "react";
import { FotaScreen } from "@/components/capture/FotaScreen";
import { FotaViewLoading } from "@/components/capture/FotaViewLoading";
import {
  isObservationId,
  parseFotaMode,
} from "@/features/imports/capture-resume";
import { loadCaptureResume } from "@/features/imports/load-capture-resume";
import {
  getCachedTodaySnapshot,
  loadHomeSnapshot,
} from "@/features/finance/load-home";
import type { FotaBootSnapshot } from "@/features/home/last-snapshot";

export const dynamic = "force-dynamic";

export default async function FotaPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; observation?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const observationId = isObservationId(params.observation)
    ? params.observation
    : null;

  return (
    <Suspense
      fallback={observationId ? <FotaViewLoading /> : <FotaScreen data={null} />}
    >
      <FotaBody params={params} />
    </Suspense>
  );
}

async function FotaBody({
  params,
}: {
  params: { mode?: string; observation?: string };
}) {
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

  const boot: FotaBootSnapshot | null = data
    ? {
        accountId: preferredAccountId,
        accounts,
        remainingTodayMinor: data.remainingTodayMinor,
        currency: data.currency,
        bootstrapping,
      }
    : null;

  return (
    <FotaScreen
      data={boot}
      error={home.ok === false ? home.error : boot ? null : "Kunde inte ladda."}
      initialMode={initialMode}
      initialPreview={resume?.preview ?? null}
      observationId={observationId}
    />
  );
}
