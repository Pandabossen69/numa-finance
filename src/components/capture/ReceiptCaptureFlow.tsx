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
import { compressImageForUpload } from "@/lib/media/compress-image";
import { goHomeInstant } from "@/lib/nav/instant";
import type { CapturePreview } from "@/features/imports/capture-preview";
import type { CaptureMode } from "@/features/imports/capture-resume";
import { CAPTURE_UI_COPY } from "@/features/imports/capture-ui-copy";

const CATEGORIES = ["Mat", "Transport", "Shopping", "Boende", "Övrigt"] as const;

function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

export function ReceiptCaptureFlow({
  accountId,
  accounts,
  remainingTodayMinor,
  currency,
  bootstrapping = false,
  initialMode = "pick",
  initialPreview = null,
}: {
  accountId: string | null;
  accounts: ShellAccount[];
  remainingTodayMinor: number;
  currency: CurrencyCode;
  bootstrapping?: boolean;
  initialMode?: CaptureMode;
  initialPreview?: CapturePreview | null;
}) {
  const [mode, setMode] = useState<CaptureMode>(() => {
    if (initialPreview && initialPreview.importKind !== "unknown") {
      return initialPreview.importKind;
    }
    return initialMode;
  });
  const [preview, setPreview] = useState<CapturePreview | null>(
    initialPreview,
  );
  const [category, setCategory] = useState<string>("Mat");
  const [amountEditable, setAmountEditable] = useState(
    Boolean(
      initialPreview &&
        initialPreview.importKind !== "bank_sms" &&
        initialPreview.importKind !== "bank_app",
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const roomBefore = Math.max(0, remainingTodayMinor);

  const impact = useMemo(() => {
    if (!preview || preview.alreadyKnown) return null;
    if (preview.importKind === "bank_app") {
      return null;
    }
    try {
      if (preview.importKind === "bank_sms") {
        const amountMinor = preview.events
          .filter((e) => e.direction === "debit")
          .reduce((sum, e) => sum + e.amountMinor, 0);
        if (amountMinor <= 0) return null;
        const remaining = roomBefore - amountMinor;
        return { amountMinor, remaining, canAfford: remaining >= 0 };
      }
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
    // Always return to the mode picker — even during bootstrap — so Manual/Kvitto stay reachable.
    setMode("pick");
  }

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setScanning(true);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setScanPreviewUrl(previewUrl);

    startTransition(async () => {
      const uploadFile = await compressImageForUpload(file, {
        preserveText: true,
      });
      const fd = new FormData();
      fd.set("file", uploadFile);
      if (mode === "bank_sms") fd.set("mode", "bank_sms");
      if (mode === "bank_app") fd.set("mode", "bank_app");

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
      const importKind: CapturePreview["importKind"] =
        data.importKind === "bank_sms"
          ? "bank_sms"
          : data.importKind === "bank_app"
            ? "bank_app"
            : mode === "bank_sms"
              ? "bank_sms"
              : mode === "bank_app"
                ? "bank_app"
                : data.importKind === "receipt"
                  ? "receipt"
                  : "receipt";

      // Auto-scan imports never fall back to manual typing — retry photo.
      if (
        (mode === "bank_sms" || mode === "bank_app") &&
        events.length === 0 &&
        !data.alreadyKnown
      ) {
        URL.revokeObjectURL(previewUrl);
        setError(
          data.message ??
            (mode === "bank_app"
              ? "Kunde inte läsa bankappen (behöver belopp + tidpunkt). Ta detaljvy eller tydligare lista."
              : "Kunde inte läsa bank-SMS (behöver belopp + saldo). Ta en tydligare skärmdump."),
        );
        return;
      }

      setAmountEditable(
        importKind !== "bank_sms" &&
          importKind !== "bank_app",
      );
      setPreview({
        observationId: data.observation.id,
        candidateId: data.candidate?.id ?? events[0]?.candidateId ?? null,
        amount: major,
        description: data.suggestedDescription ?? "",
        currency: data.currency,
        ocrStatus: data.ocrStatus,
        confidence: data.confidence ?? null,
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
    if (
      (preview.importKind === "bank_sms" ||
        preview.importKind === "bank_app") &&
      preview.events.length === 0
    ) {
      setError("Bilden måste läsas automatiskt — ta en tydligare bild.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const isAutoImport =
        preview.importKind === "bank_sms" ||
        preview.importKind === "bank_app";
      const result = await confirmReceiptExpenseAction({
        accountId:
          preview.importKind === "bank_app" ? null : accountId,
        observationId: preview.observationId,
        candidateId: preview.candidateId,
        confirmAllPending: isAutoImport,
        // Batch confirm reads amounts from candidates; placeholder avoids Zod zero.
        amount: isAutoImport ? "0" : preview.amount,
        description: preview.description || undefined,
        category:
          isAutoImport && preview.direction === "credit"
            ? null
            : isAutoImport
              ? category
              : preview.direction === "credit"
                ? null
                : category,
        fingerprint: preview.fingerprint,
        balanceAfterMinor: preview.balanceAfterMinor,
        source:
          preview.importKind === "bank_app"
            ? "bank_import"
            : isAutoImport
              ? "screenshot"
              : "receipt_camera",
        direction: preview.direction,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      URL.revokeObjectURL(preview.previewUrl);
      goHomeInstant(router);
    });
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
            className="numa-press text-sm font-semibold text-[var(--numa-accent)]"
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
            goHomeInstant(router);
          }}
        />
      </div>
    );
  }

  if (scanning || (pending && !preview)) {
    return (
      <div className="animate-rise space-y-6">
        <div className="relative min-h-56 overflow-hidden rounded-2xl bg-white/50">
          {scanPreviewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scanPreviewUrl}
                alt=""
                className="mx-auto max-h-72 min-h-56 w-full object-contain opacity-90"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/40" />
              <div className="pointer-events-none absolute inset-x-4 top-0 h-16 numa-scan-line rounded-full bg-[linear-gradient(180deg,transparent,rgba(13,122,102,0.35),transparent)]" />
            </>
          ) : (
            <div className="flex min-h-56 items-center justify-center">
              <div className="h-10 w-10 rounded-full border-2 border-[var(--numa-accent)] border-t-transparent numa-pulse-soft" />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">
            {captureCopy(mode).scanning}
          </p>
          <p className="mx-auto mt-2 max-w-[30ch] text-sm text-[var(--numa-muted)]">
            {captureCopy(mode).scanningHint}
          </p>
        </div>
      </div>
    );
  }

  if (!preview) {
    const copy = captureCopy(mode);
    const isSms = mode === "bank_sms";
    return (
      <div className="animate-rise space-y-8">
        <BackLink onClick={resetToPick} />
        <header className="space-y-2">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            {copy.eyebrow}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {bootstrapping && isSms && "titleBootstrap" in copy
              ? copy.titleBootstrap
              : copy.title}
          </h2>
          <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            {copy.hint}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => cameraInputRef.current?.click()}
            className="numa-press group flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--numa-ink)] px-3 py-5 text-white shadow-[var(--numa-shadow)] hover:bg-[var(--numa-accent)] disabled:opacity-50"
          >
            <span className="text-2xl font-light leading-none" aria-hidden>
              ◉
            </span>
            <span className="text-sm font-semibold tracking-tight">Kamera</span>
            <span className="text-center text-xs text-white/70">
              {copy.camera}
            </span>
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => galleryInputRef.current?.click()}
            className="numa-press group flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--numa-border-strong)] bg-white px-3 py-5 hover:bg-[var(--numa-accent-soft)] disabled:opacity-50"
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
              {copy.gallery}
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
          {copy.footer}
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
              "Det här finns redan sparat i NUMA. Vänta på nästa notis eller ny utgift."}
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
  const isBankApp = preview.importKind === "bank_app";
  const isAutoImport = isSms || isBankApp;
  const isCredit = preview.direction === "credit";
  const needsManualAmount = !isAutoImport && !preview.amountFromScan;
  const ocrWarn =
    !isAutoImport &&
    (needsManualAmount ||
      preview.ocrStatus === "failed" ||
      preview.ocrStatus === "unavailable" ||
      (preview.confidence != null && preview.confidence < 0.75));
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

      {isAutoImport ? (
        <div className="animate-rise-delay-1 space-y-1 text-center">
          {isSms && preview.balanceAfterMinor != null ? (
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
              {isBankApp ? "Bankapp" : "Bank-SMS"}
            </p>
          )}
          <p className="text-sm text-[var(--numa-muted)]">
            {eventCount > 1
              ? `${eventCount} rörelser lästa · +${creditCount} / −${debitCount}`
              : isCredit
                ? "Insättning läst automatiskt"
                : "Utgift läst automatiskt"}
          </p>
          {preview.message ? (
            <p className="mx-auto max-w-[34ch] pt-1 text-sm text-[var(--numa-muted)]">
              {preview.message}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            Kvitto · totalsumma
          </p>
          {preview.message ? (
            <p
              className={`rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                ocrWarn
                  ? "bg-[var(--numa-warning-soft)] text-[var(--numa-warning)]"
                  : "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
              }`}
              role={ocrWarn ? "status" : undefined}
            >
              {preview.message}
            </p>
          ) : null}
        </div>
      )}

      {isAutoImport && eventCount > 0 ? (
        <ul className="animate-rise-delay-2 divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
          {preview.events.map((event) => {
            const plus = event.direction === "credit";
            return (
              <li
                key={event.candidateId}
                className="flex items-baseline justify-between gap-4 py-3.5"
              >
                <span
                  className={`min-w-0 text-sm font-semibold ${
                    plus
                      ? "text-[var(--numa-positive)]"
                      : "text-[var(--numa-ink)]"
                  }`}
                >
                  {event.labelSv?.includes("·")
                    ? event.labelSv.split("·").slice(1).join("·").trim() ||
                      (plus ? "Insättning" : "Utgift")
                    : plus
                      ? "Insättning"
                      : "Utgift"}
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
              autoFocus={needsManualAmount || ocrWarn}
              value={preview.amount}
              onChange={(e) =>
                setPreview((p) => (p ? { ...p, amount: e.target.value } : p))
              }
              placeholder="0,00"
              className="money mt-2 w-full border-0 bg-transparent p-0 text-[2rem] font-semibold tracking-tight outline-none placeholder:text-[var(--numa-faint)]"
              aria-label="Belopp från kvittot"
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
          {!isSms && preview.amountFromScan ? (
            <p className="mt-1 text-xs text-[var(--numa-faint)]">
              Inläst från bilden — ändra om något siffror är fel.
            </p>
          ) : null}
        </div>
      )}

      {isAutoImport && preview.skippedOlderCount > 0 ? (
        <p className="text-xs text-[var(--numa-faint)]">
          {preview.skippedOlderCount} redan sparade hoppades över.
        </p>
      ) : null}

      {impact ? (
        <p className={`text-sm ${remainingTone}`}>
          {impact.canAfford ? "Inom dagsbudgeten" : "Över dagsbudgeten"} ·{" "}
          {formatMoney(money(Math.max(0, impact.remaining), currency))} kvar idag
        </p>
      ) : null}

      {!isAutoImport ? (
        <input
          value={preview.description}
          onChange={(e) =>
            setPreview((p) => (p ? { ...p, description: e.target.value } : p))
          }
          placeholder="Butik eller notis"
          className="w-full border-0 border-b border-[var(--numa-border)] bg-transparent py-2 text-sm outline-none focus:border-[var(--numa-accent)]"
        />
      ) : null}

      {(!isAutoImport && !isCredit) || (isAutoImport && debitCount > 0) ? (
        <div className="space-y-2">
          {isSms && creditCount > 0 ? (
            <p className="text-xs text-[var(--numa-faint)]">
              Kategori gäller utgifterna i bilden.
            </p>
          ) : null}
          <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`numa-press min-h-11 shrink-0 rounded-full px-4 text-sm ${
                  category === c
                    ? "bg-[var(--numa-ink)] font-semibold text-white"
                    : "bg-white font-medium text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
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
            (isAutoImport ? eventCount === 0 : !preview.amount.trim())
          }
          className="numa-btn numa-btn-primary w-full rounded-full"
        >
          {pending
            ? "Sparar…"
            : bootstrapping
              ? "Spara saldo på Hem"
              : isAutoImport && eventCount > 1
                ? `Spara ${eventCount} rörelser`
                : isAutoImport && isCredit
                  ? "Spara insättning"
                  : "Bekräfta"}
        </button>
        <button
          type="button"
          className="numa-press flex min-h-11 w-full items-center justify-center text-sm font-medium text-[var(--numa-muted)]"
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
      hint: bootstrapping
        ? "Börja här — saldot i SMS:et blir Hem"
        : "Skärmdump → allt läses in",
    },
    {
      id: "bank_app",
      title: "Bankapp",
      hint: hasAccount
        ? "bunq / Revolut — utgift utan dubblett"
        : "Kräver saldo först via SMS",
    },
    {
      id: "receipt",
      title: "Kvitto",
      hint: "Fota priset — ändra belopp om det behövs",
    },
    {
      id: "manual",
      title: "Manuellt",
      hint: hasAccount
        ? "Skriv belopp utan kamera"
        : "Bäst efter första bank-SMS",
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
            ? "Fota senaste bank-SMS först så Hem får rätt saldo. Du kan alltid välja kvitto eller manuellt."
            : "Ett steg. Vi läser bilden och du bekräftar."}
        </p>
      </header>

      <nav className="grid gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={
              (item.id === "bank_app" || item.id === "manual") && !hasAccount
            }
            onClick={() => onChoose(item.id)}
            className="numa-panel numa-press flex w-full items-center justify-between gap-4 px-4 py-4 text-left disabled:opacity-40"
          >
            <span>
              <span className="block text-[15px] font-semibold tracking-tight">
                {item.title}
              </span>
              <span className="mt-0.5 block text-sm text-[var(--numa-muted)]">
                {item.hint}
              </span>
            </span>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--numa-accent-soft)] text-sm font-semibold text-[var(--numa-accent-ink)]"
              aria-hidden
            >
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
      className="numa-press text-sm font-semibold text-[var(--numa-accent)]"
    >
      ← Tillbaka
    </button>
  );
}

function captureCopy(mode: CaptureMode) {
  if (mode === "bank_sms") return CAPTURE_UI_COPY.bank_sms;
  if (mode === "bank_app") return CAPTURE_UI_COPY.bank_app;
  return CAPTURE_UI_COPY.receipt;
}

function PreviewThumb({ src }: { src: string }) {
  return (
    <div className="min-h-48 overflow-hidden rounded-2xl bg-white/60 shadow-[var(--numa-shadow-sm)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Förhandsvisning"
        className="mx-auto max-h-56 min-h-48 w-full object-contain"
      />
    </div>
  );
}
