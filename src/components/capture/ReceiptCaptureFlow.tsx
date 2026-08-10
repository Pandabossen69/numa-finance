"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmReceiptExpenseAction,
  uploadReceiptAction,
} from "@/features/imports/actions";
import { formatMoney, money, parseUiAmountToMinor } from "@/domain/money";
import type { CurrencyCode } from "@/domain/money";

const CATEGORIES = ["Mat", "Transport", "Shopping", "Boende", "Övrigt"] as const;

type Preview = {
  observationId: string;
  candidateId: string | null;
  amount: string;
  description: string;
  currency: CurrencyCode;
  ocrStatus: "ok" | "unavailable" | "failed" | "all_known";
  message: string | null;
  previewUrl: string;
  importKind: "bank_sms" | "receipt" | "unknown";
  balanceAfterMinor: number | null;
  fingerprint: string | null;
  alreadyKnown: boolean;
  skippedOlderCount: number;
};

export function ReceiptCaptureFlow({
  accountId,
  safeToSpendTodayMinor,
  todaySpendingMinor,
  currency,
  bootstrapping = false,
}: {
  accountId: string | null;
  safeToSpendTodayMinor: number;
  todaySpendingMinor: number;
  currency: CurrencyCode;
  bootstrapping?: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [category, setCategory] = useState<string>("Mat");
  const [error, setError] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<"plus" | "even" | "minus" | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const roomBefore = safeToSpendTodayMinor - todaySpendingMinor;

  const impact = useMemo(() => {
    if (!preview || preview.alreadyKnown) return null;
    try {
      const amountMinor = parseUiAmountToMinor(preview.amount || "0");
      const remaining = roomBefore - amountMinor;
      return { amountMinor, remaining, canAfford: remaining >= 0 };
    } catch {
      return null;
    }
  }, [preview, roomBefore]);

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    const previewUrl = URL.createObjectURL(file);
    const fd = new FormData();
    fd.set("file", file);

    startTransition(async () => {
      const result = await uploadReceiptAction(fd);
      if (!result.ok) {
        URL.revokeObjectURL(previewUrl);
        setError(result.error);
        return;
      }
      const data = result.data;
      const major =
        data.suggestedAmountMinor != null
          ? (data.suggestedAmountMinor / 100).toString().replace(".", ",")
          : "";
      setPreview({
        observationId: data.observation.id,
        candidateId: data.candidate?.id ?? null,
        amount: major,
        description: data.suggestedDescription ?? "",
        currency: data.currency,
        ocrStatus: data.ocrStatus,
        message: data.message,
        previewUrl,
        importKind: data.importKind,
        balanceAfterMinor: data.balanceAfterMinor,
        fingerprint: data.fingerprint,
        alreadyKnown: data.alreadyKnown,
        skippedOlderCount: data.skippedOlderCount,
      });
    });
  }

  function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || preview.alreadyKnown) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmReceiptExpenseAction({
        accountId: accountId,
        observationId: preview.observationId,
        candidateId: preview.candidateId,
        amount: preview.amount,
        description: preview.description || undefined,
        category,
        fingerprint: preview.fingerprint,
        balanceAfterMinor: preview.balanceAfterMinor,
        source:
          preview.importKind === "bank_sms" ? "screenshot" : "receipt_camera",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDoneStatus(result.data.pulseStatus);
      URL.revokeObjectURL(preview.previewUrl);
      setTimeout(() => {
        router.push("/idag");
        router.refresh();
      }, 900);
    });
  }

  if (doneStatus) {
    const copy =
      doneStatus === "minus"
        ? "Sparat — dagen ligger minus mot planen. Inget fel, bara bra att veta."
        : doneStatus === "even"
          ? "Sparat — du ligger jämnt med dagens plan."
          : "Sparat — köpet landade plus. Bra läge.";
    return (
      <div className="numa-panel-strong space-y-3 px-5 py-8 text-center animate-rise">
        <p className="text-lg font-semibold tracking-tight">Klart</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">{copy}</p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="space-y-5">
        <label className="numa-panel flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 border-dashed px-6 text-center transition active:scale-[0.99]">
          <span className="text-base font-semibold">
            {bootstrapping ? "Fota första bank-SMS" : "Fota bank-SMS eller kvitto"}
          </span>
          <span className="max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            {bootstrapping
              ? "Senaste SMS sätter saldot (available balance) och sparar beloppet som drogs. Äldre SMS i bilden hoppas över."
              : "Skärmdumpa Bangkok Bank-SMS. Syns flera SMS läser NUMA bara den senaste nya — äldre och redan sparade hoppas över."}
          </span>
          <span className="mt-2 rounded-2xl bg-[var(--numa-accent)] px-5 py-3 text-sm font-semibold text-white">
            {pending ? "Läser…" : "Öppna kamera"}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={pending}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-[var(--numa-border)] bg-white/50 text-sm font-medium">
          Skärmbild eller galleri
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={pending}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {error ? (
          <p className="text-sm text-[var(--numa-danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (preview.alreadyKnown || preview.ocrStatus === "all_known") {
    return (
      <div className="space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.previewUrl}
          alt="Skärmbild"
          className="h-40 w-full rounded-[1.25rem] object-cover"
        />
        <div className="numa-panel p-5">
          <p className="text-sm font-semibold text-[var(--numa-ink)]">
            Inget nytt att spara
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--numa-muted)]">
            {preview.message ??
              "Alla SMS i bilden finns redan. Vänta på nästa betalning."}
          </p>
        </div>
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-sm font-semibold text-white"
          onClick={() => {
            URL.revokeObjectURL(preview.previewUrl);
            setPreview(null);
          }}
        >
          Läs en ny bild
        </button>
      </div>
    );
  }

  const remainingTone =
    impact && impact.remaining < 0
      ? "text-[var(--numa-danger)]"
      : "text-[var(--numa-positive)]";

  return (
    <form onSubmit={onConfirm} className="space-y-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview.previewUrl}
        alt="Förhandsvisning"
        className="h-40 w-full rounded-[1.25rem] object-cover"
      />

      <div className="numa-panel space-y-2 p-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
          {preview.importKind === "bank_sms"
            ? "Bangkok Bank · senaste nya SMS"
            : "Uppläst belopp"}
        </p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          {preview.message ??
            "Vi hittade ett belopp — dubbelkolla innan du sparar."}
        </p>
        {preview.balanceAfterMinor != null ? (
          <p className="text-xs text-[var(--numa-faint)]">
            Saldo efter i SMS:{" "}
            <span className="money font-medium text-[var(--numa-ink)]">
              {formatMoney(money(preview.balanceAfterMinor, preview.currency))}
            </span>
            {" · "}sparas som verifiering när du bekräftar
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Belopp
        </span>
        <input
          inputMode="decimal"
          value={preview.amount}
          onChange={(e) =>
            setPreview((p) => (p ? { ...p, amount: e.target.value } : p))
          }
          className="money w-full rounded-2xl border border-[var(--numa-border)] bg-white/70 px-4 py-4 text-3xl font-semibold outline-none ring-[var(--numa-accent)] focus:ring-2"
          aria-label="Belopp"
          required
        />
      </label>

      <div className="rounded-2xl border border-[var(--numa-border)] px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Kan jag köpa?
        </p>
        <p className={`mt-1 text-base font-semibold ${remainingTone}`}>
          {impact
            ? impact.canAfford
              ? "Ja — inom dagens trygga nivå"
              : "Nej — över dagens trygga nivå"
            : "—"}
        </p>
        <p className={`mt-2 money text-xl font-semibold ${remainingTone}`}>
          {impact ? formatMoney(money(impact.remaining, currency)) : "—"}
          <span className="ml-2 text-xs font-medium text-[var(--numa-muted)]">
            kvar efter köpet
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`min-h-10 rounded-xl px-3 text-sm transition ${
              category === c
                ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                : "text-[var(--numa-muted)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">Beskrivning</span>
        <input
          value={preview.description}
          onChange={(e) =>
            setPreview((p) => (p ? { ...p, description: e.target.value } : p))
          }
          placeholder="Butik eller kort notis"
          className="w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
      </label>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !preview.amount.trim()}
        className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white disabled:opacity-45"
      >
        {pending ? "Sparar…" : bootstrapping ? "Sätt saldo & spara" : "Bekräfta"}
      </button>
      <button
        type="button"
        className="w-full text-sm text-[var(--numa-muted)]"
        onClick={() => {
          URL.revokeObjectURL(preview.previewUrl);
          setPreview(null);
        }}
      >
        Ta ny bild
      </button>
    </form>
  );
}
