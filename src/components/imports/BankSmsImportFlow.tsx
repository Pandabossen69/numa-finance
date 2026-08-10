"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmBankSmsImportAction,
  parseBankSmsTextAction,
  uploadBankSmsAction,
} from "@/features/imports/actions";
import { formatMoney, money } from "@/domain/money";
import type { CurrencyCode } from "@/domain/money";
import type { BankSmsCandidate } from "@/domain/imports";

type ReviewState = {
  observationId: string;
  candidates: BankSmsCandidate[];
  latestBalanceAfterMinor: number | null;
  currency: CurrencyCode;
  ocrStatus: "ok" | "unavailable" | "failed" | "pasted";
  message: string | null;
  extractedText: string | null;
  previewUrl: string | null;
};

export type BankSmsAccount = {
  id: string;
  name: string;
  accountType: string;
};

export function BankSmsImportFlow({
  accountId,
  accounts,
  currency,
}: {
  accountId: string;
  accounts: BankSmsAccount[];
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"shot" | "paste">("shot");
  const [pasteText, setPasteText] = useState("");
  const [review, setReview] = useState<ReviewState | null>(null);
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [targetId, setTargetId] = useState(accountId);
  const [updateCheckpoint, setUpdateCheckpoint] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectable = useMemo(() => {
    if (!review) return [];
    return review.candidates.filter((c) => !c.duplicate && !skipped[c.id]);
  }, [review, skipped]);

  function applyResult(
    data: {
      observation: { id: string };
      candidates: BankSmsCandidate[];
      latestBalanceAfterMinor: number | null;
      currency: CurrencyCode;
      ocrStatus: ReviewState["ocrStatus"];
      message: string | null;
      extractedText: string | null;
    },
    previewUrl: string | null,
  ) {
    const initialSkip: Record<string, boolean> = {};
    for (const c of data.candidates) {
      if (c.duplicate) initialSkip[c.id] = true;
    }
    setSkipped(initialSkip);
    setReview({
      observationId: data.observation.id,
      candidates: data.candidates,
      latestBalanceAfterMinor: data.latestBalanceAfterMinor,
      currency: data.currency,
      ocrStatus: data.ocrStatus,
      message: data.message,
      extractedText: data.extractedText,
      previewUrl,
    });
  }

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setDone(null);
    const previewUrl = URL.createObjectURL(file);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadBankSmsAction(fd);
      if (!result.ok) {
        URL.revokeObjectURL(previewUrl);
        setError(result.error);
        return;
      }
      applyResult(result.data, previewUrl);
    });
  }

  function onPaste(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await parseBankSmsTextAction({ text: pasteText });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyResult(result.data, null);
    });
  }

  function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!review) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmBankSmsImportAction({
        accountId: targetId,
        observationId: review.observationId,
        updateCheckpoint,
        items: review.candidates.map((c) => ({
          fingerprint: c.fingerprint,
          direction: c.direction,
          amountMinor: c.amountMinor,
          balanceAfterMinor: c.balanceAfterMinor,
          description: c.description,
          skip: Boolean(skipped[c.id] || c.duplicate),
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (review.previewUrl) URL.revokeObjectURL(review.previewUrl);
      const bal =
        result.data.checkpointBalanceMinor != null
          ? formatMoney(
              money(result.data.checkpointBalanceMinor, review.currency),
            )
          : null;
      setDone(
        `Sparade ${result.data.createdCount} · hoppade ${result.data.skippedDuplicateCount}` +
          (bal ? ` · saldo ${bal}` : ""),
      );
      setTimeout(() => {
        router.push("/idag");
        router.refresh();
      }, 900);
    });
  }

  if (done) {
    return (
      <div className="rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-[var(--numa-ink)]">
          Klart
        </p>
        <p className="mt-2 text-sm text-[var(--numa-muted)]">{done}</p>
      </div>
    );
  }

  if (review) {
    return (
      <form onSubmit={onConfirm} className="space-y-5">
        {review.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.previewUrl}
            alt="Förhandsvisning av bank-SMS"
            className="max-h-40 w-full rounded-[1rem] object-cover object-top"
          />
        ) : null}

        {review.message ? (
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            {review.message}
          </p>
        ) : null}

        {accounts.length > 1 ? (
          <label className="block space-y-1.5">
            <span className="text-sm text-[var(--numa-muted)]">Konto</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-surface)] px-3 text-[15px]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <ul className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
          {review.candidates.map((c) => {
            const isDup = c.duplicate || skipped[c.id];
            return (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-[var(--numa-accent)]"
                  checked={!isDup}
                  disabled={c.duplicate}
                  onChange={(e) =>
                    setSkipped((prev) => ({
                      ...prev,
                      [c.id]: !e.target.checked,
                    }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">
                    {c.direction === "credit" ? "+" : "−"}
                    {formatMoney(money(c.amountMinor, review.currency))}
                    {c.duplicate ? (
                      <span className="ml-2 text-xs font-normal text-[var(--numa-faint)]">
                        redan sparad
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--numa-muted)]">
                    {c.description}
                    {c.balanceAfterMinor != null
                      ? ` · saldo ${formatMoney(money(c.balanceAfterMinor, review.currency))}`
                      : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {review.latestBalanceAfterMinor != null ? (
          <label className="flex items-start gap-3 text-sm leading-relaxed text-[var(--numa-muted)]">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-[var(--numa-accent)]"
              checked={updateCheckpoint}
              onChange={(e) => setUpdateCheckpoint(e.target.checked)}
            />
            <span>
              Uppdatera NUMA-saldo till{" "}
              {formatMoney(
                money(review.latestBalanceAfterMinor, review.currency),
              )}{" "}
              (senaste available balance i SMS)
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="text-sm text-[var(--numa-danger,#b42318)]">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={
            pending ||
            (selectable.length === 0 &&
              !(updateCheckpoint && review.latestBalanceAfterMinor != null))
          }
          className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? "Sparar…"
            : selectable.length === 0
              ? updateCheckpoint && review.latestBalanceAfterMinor != null
                ? "Uppdatera bara saldo"
                : "Inget nytt att spara"
              : `Spara ${selectable.length} nya`}
        </button>

        <button
          type="button"
          onClick={() => {
            if (review.previewUrl) URL.revokeObjectURL(review.previewUrl);
            setReview(null);
            setError(null);
          }}
          className="flex min-h-12 w-full items-center justify-center text-sm text-[var(--numa-muted)]"
        >
          Börja om
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("shot")}
          className={`min-h-11 flex-1 rounded-xl text-sm font-medium ${
            mode === "shot"
              ? "bg-[var(--numa-accent)] text-white"
              : "border border-[var(--numa-border)] text-[var(--numa-muted)]"
          }`}
        >
          Skärmbild
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`min-h-11 flex-1 rounded-xl text-sm font-medium ${
            mode === "paste"
              ? "bg-[var(--numa-accent)] text-white"
              : "border border-[var(--numa-border)] text-[var(--numa-muted)]"
          }`}
        >
          Klistra in
        </button>
      </div>

      {mode === "shot" ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            Efter köpet: skärmdumpa Bangkok Bank-SMS:et. Vi läser belopp +
            available balance — samma betalning sparas inte två gånger även om
            datum saknas.
          </p>
          <label className="flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-center">
            <span className="text-[15px] font-semibold">
              {pending ? "Läser…" : "Välj skärmbild"}
            </span>
            <span className="mt-1 text-xs text-[var(--numa-faint)]">
              Kamerarulle eller dela från Meddelanden
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
        </div>
      ) : (
        <form onSubmit={onPaste} className="space-y-3">
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            Fungerar även utan OCR — kopiera SMS-texten från Meddelanden och
            klistra in här.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder="Withdrawal/transfer/payment from your account X6591 of Bt …"
            className="w-full rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-3 text-sm leading-relaxed"
          />
          <button
            type="submit"
            disabled={pending || pasteText.trim().length < 10}
            className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Tolkar…" : "Tolka SMS"}
          </button>
        </form>
      )}

      {error ? (
        <p className="text-sm text-[var(--numa-danger,#b42318)]">{error}</p>
      ) : null}

      <p className="text-xs leading-relaxed text-[var(--numa-faint)]">
        Primär valuta: {currency}. Fingerprint = konto + riktning + belopp +
        saldo efter — därför behövs inget datum för dedupe.
      </p>
    </div>
  );
}
