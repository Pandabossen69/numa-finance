"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  QuickAddForms,
  type ShellAccount,
} from "@/components/add/QuickAddForms";
import {
  confirmReceiptExpenseAction,
  uploadReceiptAction,
} from "@/features/imports/actions";
import { formatMoney, money, parseUiAmountToMinor } from "@/domain/money";
import type { CurrencyCode } from "@/domain/money";

const CATEGORIES = ["Mat", "Transport", "Shopping", "Boende", "Övrigt"] as const;

type CaptureMode = "pick" | "bank_sms" | "receipt" | "manual";

type PreviewEvent = {
  candidateId: string;
  direction: "debit" | "credit";
  amountMinor: number;
  labelSv: string;
};

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
  amountFromScan: boolean;
  direction: "debit" | "credit" | null;
  events: PreviewEvent[];
};

function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

export function ReceiptCaptureFlow({
  accountId,
  accounts,
  perDayBudgetMinor,
  todaySpendingMinor,
  currency,
  bootstrapping = false,
  initialMode = "pick",
}: {
  accountId: string | null;
  accounts: ShellAccount[];
  perDayBudgetMinor: number;
  todaySpendingMinor: number;
  currency: CurrencyCode;
  bootstrapping?: boolean;
  initialMode?: CaptureMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CaptureMode>(
    bootstrapping ? "bank_sms" : initialMode,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [category, setCategory] = useState<string>("Mat");
  const [amountEditable, setAmountEditable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<"plus" | "even" | "minus" | null>(
    null,
  );
  const [doneBalanceMinor, setDoneBalanceMinor] = useState<number | null>(null);
  const [doneDirection, setDoneDirection] = useState<
    "debit" | "credit" | null
  >(null);
  const [scanning, setScanning] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const roomBefore = Math.max(0, perDayBudgetMinor - todaySpendingMinor);

  const impact = useMemo(() => {
    if (!preview || preview.alreadyKnown) return null;
    if (preview.importKind === "bank_sms") return null;
    try {
      const amountMinor = parseUiAmountToMinor(preview.amount || "0");
      const remaining = roomBefore - amountMinor;
      return { amountMinor, remaining, canAfford: remaining >= 0 };
    } catch {
      return null;
    }
  }, [preview, roomBefore]);

  function resetToPick() {
    if (preview?.previewUrl) URL.revokeObjectURL(preview.previewUrl);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    setPreview(null);
    setScanPreviewUrl(null);
    setError(null);
    setAmountEditable(false);
    setScanning(false);
    setMode(bootstrapping ? "bank_sms" : "pick");
  }

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setScanning(true);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setScanPreviewUrl(previewUrl);
    const fd = new FormData();
    fd.set("file", file);
    if (mode === "bank_sms") fd.set("mode", "bank_sms");

    startTransition(async () => {
      const result = await uploadReceiptAction(fd);
      setScanning(false);
      setScanPreviewUrl(null);
      if (!result.ok) {
        URL.revokeObjectURL(previewUrl);
        setError(result.error);
        return;
      }
      const data = result.data;
      const events = (data.events ?? []).map((e) => ({
        candidateId: e.candidateId,
        direction: e.direction,
        amountMinor: e.amountMinor,
        labelSv: e.labelSv,
      }));
      const hasAmount =
        data.suggestedAmountMinor != null || events.length > 0;
      const major =
        data.suggestedAmountMinor != null
          ? minorToInput(data.suggestedAmountMinor)
          : "";
      const importKind: Preview["importKind"] =
        data.importKind === "bank_sms"
          ? "bank_sms"
          : mode === "bank_sms"
            ? "bank_sms"
            : data.importKind === "receipt"
              ? "receipt"
              : "receipt";

      // Bank-SMS never falls back to manual typing — retry with clearer photo.
      if (mode === "bank_sms" && events.length === 0 && !data.alreadyKnown) {
        URL.revokeObjectURL(previewUrl);
        setError(
          data.message ??
            "Kunde inte läsa bank-SMS (behöver belopp + saldo). Ta en tydligare skärmdump.",
        );
        return;
      }
      // Keep the same object URL for the confirm view.

      setAmountEditable(importKind !== "bank_sms" && !hasAmount);
      setPreview({
        observationId: data.observation.id,
        candidateId: data.candidate?.id ?? events[0]?.candidateId ?? null,
        amount: major,
        description: data.suggestedDescription ?? "",
        currency: data.currency,
        ocrStatus: data.ocrStatus,
        message: data.message,
        previewUrl,
        importKind,
        balanceAfterMinor: data.balanceAfterMinor,
        fingerprint: data.fingerprint,
        alreadyKnown: data.alreadyKnown,
        skippedOlderCount: data.skippedOlderCount,
        amountFromScan: hasAmount,
        direction: data.direction ?? events[0]?.direction ?? null,
        events,
      });
    });
  }

  function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || preview.alreadyKnown) return;
    if (preview.importKind === "bank_sms" && preview.events.length === 0) {
      setError("Bank-SMS måste läsas automatiskt — ta en tydligare bild.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const isSms = preview.importKind === "bank_sms";
      const result = await confirmReceiptExpenseAction({
        accountId: accountId,
        observationId: preview.observationId,
        candidateId: preview.candidateId,
        confirmAllPending: isSms,
        amount: isSms ? "1" : preview.amount,
        description: preview.description || undefined,
        category:
          isSms || preview.direction === "credit" ? null : category,
        fingerprint: preview.fingerprint,
        balanceAfterMinor: preview.balanceAfterMinor,
        source: isSms ? "screenshot" : "receipt_camera",
        direction: preview.direction,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDoneStatus(result.data.pulseStatus);
      setDoneBalanceMinor(result.data.balanceAfterMinor);
      setDoneDirection(result.data.direction);
      URL.revokeObjectURL(preview.previewUrl);
      setTimeout(() => {
        router.push("/idag");
        router.refresh();
      }, 1400);
    });
  }

  if (doneStatus) {
    return (
      <div className="animate-rise space-y-4 py-14 text-center">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[var(--numa-faint)]">
          {doneDirection === "credit" ? "Insättning sparad" : "Sparat"}
        </p>
        {doneBalanceMinor != null ? (
          <>
            <p className="text-sm text-[var(--numa-muted)]">Ditt saldo nu</p>
            <p className="money text-4xl font-semibold tracking-tight text-[var(--numa-positive)]">
              {formatMoney(money(doneBalanceMinor, currency))}
            </p>
            <p className="mx-auto max-w-[28ch] text-sm text-[var(--numa-muted)]">
              Hem uppdateras — du lever på det här tills nästa intäkt.
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-semibold tracking-tight">Klart</p>
            <p className="mx-auto max-w-[28ch] text-sm text-[var(--numa-muted)]">
              Hem uppdateras med nya siffror.
            </p>
          </>
        )}
      </div>
    );
  }

  if (mode === "pick") {
    return (
      <ModePicker
        bootstrapping={bootstrapping}
        onChoose={setMode}
        hasAccount={Boolean(accountId)}
      />
    );
  }

  if (mode === "manual") {
    if (!accountId) {
      return (
        <div className="animate-rise space-y-6">
          <BackLink onClick={resetToPick} />
          <p className="text-sm text-[var(--numa-muted)]">
            Fota först ett bank-SMS så NUMA vet ditt saldo.
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--numa-accent)]"
            onClick={() => setMode("bank_sms")}
          >
            Fota bank-SMS →
          </button>
        </div>
      );
    }
    return (
      <div className="animate-rise space-y-6">
        <BackLink onClick={resetToPick} />
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Manuellt</h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">
            Skriv belopp utan kamera.
          </p>
        </header>
        <QuickAddForms
          primaryAccountId={accountId}
          accounts={accounts}
          onSuccess={() => {
            router.push("/idag");
            router.refresh();
          }}
        />
      </div>
    );
  }

  if (scanning || (pending && !preview)) {
    return (
      <div className="animate-rise space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-white/50">
          {scanPreviewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scanPreviewUrl}
                alt=""
                className="mx-auto max-h-72 w-full object-contain opacity-90"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/40" />
              <div className="pointer-events-none absolute inset-x-4 top-0 h-16 numa-scan-line rounded-full bg-[linear-gradient(180deg,transparent,rgba(13,122,102,0.35),transparent)]" />
            </>
          ) : (
            <div className="flex h-48 items-center justify-center">
              <div className="h-10 w-10 rounded-full border-2 border-[var(--numa-accent)] border-t-transparent numa-pulse-soft" />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">Läser SMS…</p>
          <p className="mx-auto mt-2 max-w-[30ch] text-sm text-[var(--numa-muted)]">
            Hämtar +/− och saldo automatiskt — du behöver inte skriva något.
          </p>
        </div>
      </div>
    );
  }

  if (!preview) {
    const isSms = mode === "bank_sms";
    return (
      <div className="animate-rise space-y-8">
        {!bootstrapping ? <BackLink onClick={resetToPick} /> : null}
        <header className="space-y-2">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            {isSms ? "Bank-SMS" : "Kvitto"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {bootstrapping
              ? "Fota senaste SMS"
              : isSms
                ? "Importera SMS"
                : "Fota priset"}
          </h2>
          <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            {isSms
              ? "Välj skärmdump från galleriet — eller fota skärmen. Vi läser alla bubblor (+/−) och sätter saldo."
              : "Håll texten skarp. Beloppet fylls i automatiskt."}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => cameraInputRef.current?.click()}
            className="group flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--numa-ink)] px-3 py-5 text-white shadow-[var(--numa-shadow)] transition hover:bg-[var(--numa-accent)] active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-2xl font-light leading-none" aria-hidden>
              ◉
            </span>
            <span className="text-sm font-semibold tracking-tight">Kamera</span>
            <span className="text-center text-xs text-white/70">
              Fota skärmen nu
            </span>
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => galleryInputRef.current?.click()}
            className="group flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--numa-border)] bg-white/70 px-3 py-5 transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
          >
            <span
              className="text-2xl font-light leading-none text-[var(--numa-ink)]"
              aria-hidden
            >
              ▤
            </span>
            <span className="text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
              Galleri
            </span>
            <span className="text-center text-xs text-[var(--numa-muted)]">
              Välj skärmdump
            </span>
          </button>
        </div>

        {/* Camera: capture forces camera app on phones */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {/* Gallery: no capture → photo library / file picker */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <p className="text-center text-xs text-[var(--numa-faint)]">
          {isSms
            ? "3–6 bubblor i samma bild går bra · samma SMS igen hoppas över"
            : "Beloppet synligt i bild"}
        </p>

        {error ? (
          <p className="text-center text-sm text-[var(--numa-danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (preview.alreadyKnown || preview.ocrStatus === "all_known") {
    return (
      <div className="animate-rise space-y-8">
        <PreviewThumb src={preview.previewUrl} />
        <div className="space-y-2 text-center">
          <p className="text-xl font-semibold tracking-tight">Inget nytt</p>
          <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            {preview.message ??
              "Det här SMS:et finns redan. Vänta på nästa notis från banken."}
          </p>
        </div>
        <button
          type="button"
          className="mx-auto block text-sm font-semibold text-[var(--numa-accent)]"
          onClick={() => {
            URL.revokeObjectURL(preview.previewUrl);
            setPreview(null);
            setAmountEditable(false);
          }}
        >
          Ta ny bild
        </button>
      </div>
    );
  }

  const isSms = preview.importKind === "bank_sms";
  const isCredit = preview.direction === "credit";
  const needsManualAmount = !isSms && !preview.amountFromScan;
  const remainingTone =
    impact && impact.remaining < 0
      ? "text-[var(--numa-danger)]"
      : "text-[var(--numa-positive)]";
  const eventCount = preview.events.length;
  const creditCount = preview.events.filter((e) => e.direction === "credit")
    .length;
  const debitCount = preview.events.filter((e) => e.direction === "debit")
    .length;

  return (
    <form onSubmit={onConfirm} className="animate-rise space-y-7">
      <PreviewThumb src={preview.previewUrl} />

      {isSms ? (
        <div className="animate-rise-delay-1 space-y-1 text-center">
          {preview.balanceAfterMinor != null ? (
            <>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
                Saldo på Hem
              </p>
              <p className="money-hero money text-4xl font-semibold tracking-tight text-[var(--numa-positive)]">
                {formatMoney(
                  money(preview.balanceAfterMinor, preview.currency),
                )}
              </p>
            </>
          ) : (
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
              Bank-SMS
            </p>
          )}
          <p className="text-sm text-[var(--numa-muted)]">
            {eventCount > 1
              ? `${eventCount} rörelser lästa · +${creditCount} / −${debitCount}`
              : isCredit
                ? "Insättning läst automatiskt"
                : "Utgift läst automatiskt"}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            Kvitto
          </p>
          {preview.message ? (
            <p className="text-sm text-[var(--numa-muted)]">{preview.message}</p>
          ) : null}
        </div>
      )}

      {isSms && eventCount > 0 ? (
        <ul className="animate-rise-delay-2 divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
          {preview.events.map((event) => {
            const plus = event.direction === "credit";
            return (
              <li
                key={event.candidateId}
                className="flex items-baseline justify-between gap-4 py-3.5"
              >
                <span
                  className={`text-sm font-semibold ${
                    plus
                      ? "text-[var(--numa-positive)]"
                      : "text-[var(--numa-ink)]"
                  }`}
                >
                  {plus ? "Insättning" : "Utgift"}
                </span>
                <span
                  className={`money shrink-0 text-lg font-semibold ${
                    plus
                      ? "text-[var(--numa-positive)]"
                      : "text-[var(--numa-ink)]"
                  }`}
                >
                  {plus ? "+" : "−"}
                  {formatMoney(money(event.amountMinor, preview.currency))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            Belopp
          </p>
          {amountEditable || needsManualAmount ? (
            <input
              inputMode="decimal"
              autoFocus={needsManualAmount}
              value={preview.amount}
              onChange={(e) =>
                setPreview((p) => (p ? { ...p, amount: e.target.value } : p))
              }
              placeholder="0,00"
              className="money mt-2 w-full border-0 bg-transparent p-0 text-4xl font-semibold tracking-tight outline-none placeholder:text-[var(--numa-faint)]"
              aria-label="Belopp"
              required
            />
          ) : (
            <p className="money mt-2 text-4xl font-semibold tracking-tight">
              {preview.amount || "—"}
              <span className="ml-2 text-base font-medium text-[var(--numa-faint)]">
                {preview.currency}
              </span>
            </p>
          )}
        </div>
      )}

      {isSms && preview.skippedOlderCount > 0 ? (
        <p className="text-xs text-[var(--numa-faint)]">
          {preview.skippedOlderCount} redan sparade SMS hoppades över.
        </p>
      ) : null}

      {impact ? (
        <p className={`text-sm ${remainingTone}`}>
          {impact.canAfford ? "Inom dagens budget" : "Över dagens budget"} ·{" "}
          {formatMoney(money(impact.remaining, currency))} kvar
        </p>
      ) : null}

      {!isSms ? (
        <input
          value={preview.description}
          onChange={(e) =>
            setPreview((p) => (p ? { ...p, description: e.target.value } : p))
          }
          placeholder="Butik eller notis"
          className="w-full border-0 border-b border-[var(--numa-border)] bg-transparent py-2 text-sm outline-none focus:border-[var(--numa-accent)]"
        />
      ) : null}

      {isSms && debitCount > 0 && creditCount === 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm transition ${
                category === c
                  ? "bg-[var(--numa-ink)] font-semibold text-white"
                  : "text-[var(--numa-muted)] hover:bg-white/60"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 pt-2">
        <button
          type="submit"
          disabled={
            pending ||
            (isSms ? eventCount === 0 : !preview.amount.trim())
          }
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--numa-ink)] text-sm font-semibold text-white disabled:opacity-45"
        >
          {pending
            ? "Sparar…"
            : bootstrapping
              ? "Spara saldo på Hem"
              : isSms && eventCount > 1
                ? `Spara ${eventCount} rörelser`
                : isSms && isCredit
                  ? "Spara insättning"
                  : "Bekräfta"}
        </button>
        <button
          type="button"
          className="w-full py-2 text-sm text-[var(--numa-muted)]"
          onClick={() => {
            URL.revokeObjectURL(preview.previewUrl);
            setPreview(null);
            setAmountEditable(false);
          }}
        >
          Ta ny bild
        </button>
      </div>
    </form>
  );
}

function ModePicker({
  bootstrapping,
  onChoose,
  hasAccount,
}: {
  bootstrapping: boolean;
  onChoose: (mode: CaptureMode) => void;
  hasAccount: boolean;
}) {
  const items: Array<{
    id: CaptureMode;
    title: string;
    hint: string;
  }> = [
    {
      id: "bank_sms",
      title: "Bank-SMS",
      hint: "Skärmdump → allt läses in",
    },
    {
      id: "receipt",
      title: "Kvitto",
      hint: "Fota priset på kvitto eller skärm",
    },
    {
      id: "manual",
      title: "Manuellt",
      hint: hasAccount
        ? "Skriv belopp utan kamera"
        : "Kräver saldo först via SMS",
    },
  ];

  return (
    <div className="animate-rise space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {bootstrapping ? "Kom igång" : "Vad vill du lägga till?"}
        </h2>
        <p className="max-w-[34ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {bootstrapping
            ? "Fota senaste bank-SMS. Available balance blir saldo på Hem."
            : "Ett steg. Vi läser bilden och du bekräftar."}
        </p>
      </header>

      <nav className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChoose(item.id)}
            className="flex w-full items-baseline justify-between gap-4 py-5 text-left transition hover:opacity-80 active:opacity-60"
          >
            <span>
              <span className="block text-[15px] font-semibold tracking-tight">
                {item.title}
              </span>
              <span className="mt-0.5 block text-sm text-[var(--numa-muted)]">
                {item.hint}
              </span>
            </span>
            <span className="text-[var(--numa-faint)]" aria-hidden>
              →
            </span>
          </button>
        ))}
      </nav>

      <p className="text-center text-xs text-[var(--numa-faint)]">
        <Link href="/transaktioner" className="font-semibold text-[var(--numa-accent)]">
          Se rörelser
        </Link>
      </p>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-[var(--numa-accent)]"
    >
      ← Tillbaka
    </button>
  );
}

function PreviewThumb({ src }: { src: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/60 shadow-[var(--numa-shadow-sm)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Förhandsvisning"
        className="mx-auto max-h-56 w-full object-contain"
      />
    </div>
  );
}
