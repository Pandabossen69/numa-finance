"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  MerListGroup,
  MerListLink,
  MerListRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { ImporteraViewLoading } from "@/components/mer/MerViewLoading";
import { DEFAULT_TIMEZONE, formatListDateSv } from "@/domain/finance";
import { rejectBankMailAction } from "@/features/imports/bank-mail-actions";
import { fotaHrefForObservation } from "@/features/imports/capture-resume";
import {
  bankMailConfirmHeading,
  isPendingBankMail,
  splitImporteraRows,
} from "@/features/imports/bank-mail-queue";
import { refreshAfterBankMailQueueChange } from "@/features/imports/bank-mail-queue-refresh";
import {
  lastImporteraRows,
  rememberImporteraRows,
  subscribeImporteraRows,
  type ImporteraRow,
} from "@/features/home/last-snapshot";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import { serverNull } from "@/lib/react/server-snapshot";

export function ImporteraScreen({
  data,
}: {
  data: ImporteraRow[] | null;
}) {
  const { prefetch } = usePrefetchOnIntent();
  const stored = useSyncExternalStore(
    subscribeImporteraRows,
    lastImporteraRows,
    serverNull,
  );
  const serverStamp =
    data?.map((row) => `${row.id}:${row.status}:${row.notes ?? ""}`).join("|") ??
    null;
  const appliedServer = useRef<string | null>(null);

  useEffect(() => {
    if (!data || serverStamp === null) return;
    if (appliedServer.current === serverStamp) return;
    appliedServer.current = serverStamp;
    rememberImporteraRows(data);
  }, [data, serverStamp]);

  const observations = stored ?? data;

  if (!observations) return <ImporteraViewLoading />;

  const { pendingMail, rest } = splitImporteraRows(observations);

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7">
      <MerPageHeader back title="Tidigare bilder" />

      <div className="animate-rise-delay-1 space-y-6">
        <MerSection>
          <MerListGroup>
            <MerListLink href="/fota" label="Fota saldo eller kvitto" />
          </MerListGroup>
        </MerSection>

        {pendingMail.length > 0 ? (
          <MerSection title={bankMailConfirmHeading(pendingMail.length)}>
            <div id="att-bekrafta">
              <ObservationList rows={pendingMail} prefetch={prefetch} mailQueue />
            </div>
          </MerSection>
        ) : null}

        <MerSection title="Senaste">
          {rest.length === 0 ? (
            <MerListGroup>
              <MerListRow>
                <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
                  Inga bilder ännu.
                </p>
              </MerListRow>
            </MerListGroup>
          ) : (
            <ObservationList rows={rest} prefetch={prefetch} />
          )}
        </MerSection>
      </div>
    </div>
  );
}

function ObservationList({
  rows,
  prefetch,
  mailQueue = false,
}: {
  rows: ImporteraRow[];
  prefetch: (href: string) => void;
  mailQueue?: boolean;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onReject(id: string) {
    setRejectingId(id);
    setError(null);
    const result = await rejectBankMailAction({ observationId: id });
    if (!result.ok) {
      setRejectingId(null);
      setError(result.error);
      return;
    }
    void refreshAfterBankMailQueueChange(id, "Avvisad");
    setRejectingId(null);
  }

  return (
    <MerListGroup>
      {rows.map((o) => {
        const status = statusMeta(o.status);
        const resumeHref = fotaHrefForObservation(o);
        const canReject = mailQueue && isPendingBankMail(o);
        return (
          <MerListRow key={o.id} className="space-y-1.5 py-3.5">
            <div className="numa-money-line items-start">
              <p className="numa-money-line-label text-[15px] font-medium tracking-tight text-[var(--numa-ink)]">
                {kindLabel(o.kind)}
              </p>
              <span
                className={`numa-status-chip text-[11px] font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <p className="text-[12px] text-[var(--numa-faint)]">
              {formatListDateSv(o.createdAt, DEFAULT_TIMEZONE, {
                withTime: true,
              })}
            </p>
            {o.notes ? (
              <p className="text-sm leading-snug text-[var(--numa-muted)]">
                {o.notes}
              </p>
            ) : null}
            {o.status === "needs_review" || o.status === "failed" ? (
              <p className="flex flex-wrap items-center gap-x-4 pt-1">
                <Link
                  href={resumeHref}
                  prefetch
                  onMouseEnter={() => prefetch(resumeHref)}
                  onFocus={() => prefetch(resumeHref)}
                  className="numa-tap text-sm font-semibold text-[var(--numa-accent)]"
                >
                  {o.status === "failed" ? "Fota igen →" : "Fortsätt i + →"}
                </Link>
                {canReject ? (
                  <button
                    type="button"
                    disabled={rejectingId === o.id}
                    onClick={() => void onReject(o.id)}
                    className="numa-press numa-tap text-sm font-semibold text-[var(--numa-danger)]"
                  >
                    {rejectingId === o.id ? "Avvisar…" : "Avvisa"}
                  </button>
                ) : null}
              </p>
            ) : null}
          </MerListRow>
        );
      })}
      {error ? (
        <MerListRow>
          <p className="text-sm text-[var(--numa-danger)]" role="alert">
            {error}
          </p>
        </MerListRow>
      ) : null}
    </MerListGroup>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "receipt":
      return "Kvitto";
    case "screenshot":
      return "Skärmbild";
    case "bank_mail":
      return "Bangkok Bank-mejl";
    case "price":
      return "Pris";
    default:
      return "Bild";
  }
}

function statusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case "uploaded":
      return {
        label: "Mottagen",
        className: "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]",
      };
    case "extracting":
      return {
        label: "Läser",
        className: "bg-[var(--numa-warning-soft)] text-[var(--numa-warning)]",
      };
    case "needs_review":
      return {
        label: "Väntar på dig",
        className: "bg-[var(--numa-warning-soft)] text-[var(--numa-warning)]",
      };
    case "processed":
      return {
        label: "Sparad",
        className: "bg-[var(--numa-positive-soft)] text-[var(--numa-positive)]",
      };
    case "failed":
      return {
        label: "Kunde inte läsas",
        className: "bg-[var(--numa-danger-soft)] text-[var(--numa-danger)]",
      };
    default:
      return {
        label: status,
        className: "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]",
      };
  }
}
