"use client";

import { useMemo, useState, useTransition } from "react";
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
  ocrStatus: "ok" | "unavailable" | "failed";
  message: string | null;
  previewUrl: string;
};

export type ReceiptAccount = {
  id: string;
  name: string;
  accountType: string;
};

export function ReceiptCaptureFlow({
  accountId,
  accounts,
  safeToSpendTodayMinor,
  currency,
}: {
  accountId: string;
  accounts: ReceiptAccount[];
  safeToSpendTodayMinor: number;
  currency: CurrencyCode;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [targetId, setTargetId] = useState(accountId);
  const [category, setCategory] = useState<string>("Mat");
  const [error, setError] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<"plus" | "even" | "minus" | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const impact = useMemo(() => {
    if (!preview) return null;
    try {
      const amountMinor = parseUiAmountToMinor(preview.amount || "0");
      const remaining = safeToSpendTodayMinor - amountMinor;
      return { amountMinor, remaining };
    } catch {
      return null;
    }
  }, [preview, safeToSpendTodayMinor]);

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
      });
    });
  }

  function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmReceiptExpenseAction({
        accountId: targetId,
        observationId: preview.observationId,
        candidateId: preview.candidateId,
        amount: preview.amount,
        description: preview.description || undefined,
        category,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDoneStatus(result.data.pulseStatus);
      URL.revokeObjectURL(preview.previewUrl);
      window.setTimeout(() => {
        window.location.assign("/idag");
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
      <div className="space-y-3 rounded-[1.5rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-5 py-8 text-center animate-sheet">
        <p className="text-lg font-semibold tracking-tight">Klart</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">{copy}</p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="space-y-5">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-[var(--numa-border)] bg-[var(--numa-surface)] px-6 text-center transition active:scale-[0.99]">
          <span className="text-base font-semibold">Ta bild eller välj kvitto</span>
          <span className="max-w-[28ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            Öppna kameran, fotografera, och bekräfta beloppet mot vad du tryggt
            kan spendera idag.
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
        <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium">
          Välj från galleri
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

  const remainingTone =
    impact && impact.remaining < 0
      ? "text-[var(--numa-danger)]"
      : "text-[var(--numa-positive)]";

  return (
    <form onSubmit={onConfirm} className="space-y-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview.previewUrl}
        alt="Förhandsvisning av kvitto"
        className="h-40 w-full rounded-[1.25rem] object-cover"
      />

      {preview.message ? (
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          {preview.message}
        </p>
      ) : (
        <p className="text-sm font-medium text-[var(--numa-accent)]">
          Vi hittade ett belopp — dubbelkolla innan du sparar.
        </p>
      )}

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
          Efter köpet · tryggt idag
        </p>
        <p className={`mt-1 money text-xl font-semibold ${remainingTone}`}>
          {impact
            ? formatMoney(money(impact.remaining, currency))
            : "—"}
        </p>
        <p className="mt-1 text-xs text-[var(--numa-muted)]">
          Just nu tryggt: {formatMoney(money(safeToSpendTodayMinor, currency))}
        </p>
      </div>

      {accounts.length > 1 ? (
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
            Från konto
          </span>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-white/70 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.accountType === "cash" ? " · Kontanter" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
        {pending ? "Sparar…" : "Bekräfta köp"}
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
