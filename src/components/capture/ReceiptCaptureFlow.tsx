"use client";

import { useMemo, useState, useTransition } from "react";
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
};

function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

export function ReceiptCaptureFlow({
  accountId,
  accounts,
  safeToSpendTodayMinor,
  todaySpendingMinor,
  currency,
  bootstrapping = false,
  initialMode = "pick",
}: {
  accountId: string | null;
  accounts: ShellAccount[];
  safeToSpendTodayMinor: number;
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
  const [pending, startTransition] = useTransition();

  const roomBefore = safeToSpendTodayMinor - todaySpendingMinor;

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
    setPreview(null);
    setError(null);
    setAmountEditable(false);
    setMode(bootstrapping ? "bank_sms" : "pick");
  }

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
      const hasAmount = data.suggestedAmountMinor != null;
      const major = hasAmount
        ? minorToInput(data.suggestedAmountMinor!)
        : "";
      setAmountEditable(!hasAmount);
      setPreview({
        observationId: data.observation.id,
        candidateId: data.candidate?.id ?? null,
        amount: major,
        description: data.suggestedDescription ?? "",
        currency: data.currency,
        ocrStatus: data.ocrStatus,
        message: data.message,
        previewUrl,
        importKind:
          mode === "bank_sms"
            ? "bank_sms"
            : data.importKind === "bank_sms"
              ? "bank_sms"
              : "receipt",
        balanceAfterMinor: data.balanceAfterMinor,
        fingerprint: data.fingerprint,
        alreadyKnown: data.alreadyKnown,
        skippedOlderCount: data.skippedOlderCount,
        amountFromScan: hasAmount,
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
        ? "Sparat. Dagen ligger lite över planen — inget fel, bara bra att veta."
        : doneStatus === "even"
          ? "Sparat. Du ligger jämnt med dagens plan."
          : "Sparat. Bra läge.";
    return (
      <div className="rounded-[1.75rem] bg-white/90 px-6 py-12 text-center shadow-[var(--numa-shadow-sm)] animate-rise">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--numa-accent)]">
          Klart
        </p>
        <p className="mt-3 text-2xl font-semibold tracking-tight">Sparat</p>
        <p className="mx-auto mt-3 max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {copy}
        </p>
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
        <div className="space-y-4">
          <BackLink onClick={resetToPick} />
          <div className="rounded-[1.75rem] bg-white/90 p-6 shadow-[var(--numa-shadow-sm)]">
            <p className="text-base font-semibold">Nästan klart</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--numa-muted)]">
              Fota först ett bank-SMS så NUMA vet ditt saldo — sedan kan du
              skriva in utgifter manuellt.
            </p>
            <button
              type="button"
              className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--numa-accent)] text-sm font-semibold text-white"
              onClick={() => setMode("bank_sms")}
            >
              Fota bank-SMS
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-5 animate-rise">
        <BackLink onClick={resetToPick} />
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Skriv belopp</h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">
            Snabb utgift eller intäkt — utan kamera.
          </p>
        </header>
        <div className="rounded-[1.75rem] bg-white/90 p-5 shadow-[var(--numa-shadow-sm)]">
          <QuickAddForms
            primaryAccountId={accountId}
            accounts={accounts}
            onSuccess={() => {
              router.push("/idag");
              router.refresh();
            }}
          />
        </div>
      </div>
    );
  }

  if (!preview) {
    const isSms = mode === "bank_sms";
    return (
      <div className="space-y-5 animate-rise">
        {!bootstrapping ? <BackLink onClick={resetToPick} /> : null}
        <header>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--numa-accent)]">
            {isSms ? "Bank-SMS" : "Kvitto"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {bootstrapping
              ? "Fota första SMS"
              : isSms
                ? "Importera från SMS"
                : "Fota priset"}
          </h2>
          <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            {bootstrapping
              ? "Ta en skärmdump av senaste Bangkok Bank-SMS. NUMA läser beloppet som drogs och sätter ditt saldo."
              : isSms
                ? "Skärmdumpa SMS:et. Beloppet fylls i automatiskt — du behöver bara bekräfta."
                : "Fota kvittot eller prislappen. Beloppet läses in — du kan alltid justera."}
          </p>
        </header>

        <label className="group relative flex min-h-[13.5rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.75rem] bg-[var(--numa-ink)] px-6 text-center text-white shadow-[var(--numa-shadow)] transition active:scale-[0.985]">
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(13,122,102,0.45),transparent_55%)]" />
          <span className="relative text-[15px] font-semibold tracking-tight">
            {pending ? "Läser bilden…" : "Öppna kamera"}
          </span>
          <span className="relative mt-2 max-w-[28ch] text-xs leading-relaxed text-white/70">
            {isSms
              ? "Helst senaste SMS högst upp i notisen"
              : "Håll texten skarp och beloppet synligt"}
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

        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-white/70 text-sm font-semibold text-[var(--numa-ink)] transition active:scale-[0.99]">
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

  if (preview.alreadyKnown || preview.ocrStatus === "all_known") {
    return (
      <div className="space-y-5 animate-rise">
        <PreviewThumb src={preview.previewUrl} />
        <div className="rounded-[1.75rem] bg-white/90 p-6 shadow-[var(--numa-shadow-sm)]">
          <p className="text-lg font-semibold tracking-tight">Inget nytt</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--numa-muted)]">
            {preview.message ??
              "Det här SMS:et finns redan sparat. Vänta på nästa."}
          </p>
        </div>
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--numa-accent)] text-sm font-semibold text-white"
          onClick={() => {
            URL.revokeObjectURL(preview.previewUrl);
            setPreview(null);
            setAmountEditable(false);
          }}
        >
          Försök med ny bild
        </button>
      </div>
    );
  }

  const isSms = preview.importKind === "bank_sms";
  const needsManualAmount = !preview.amountFromScan;
  const remainingTone =
    impact && impact.remaining < 0
      ? "text-[var(--numa-danger)]"
      : "text-[var(--numa-positive)]";

  return (
    <form onSubmit={onConfirm} className="space-y-5 animate-rise">
      <PreviewThumb src={preview.previewUrl} />

      <div className="rounded-[1.75rem] bg-white/90 p-5 shadow-[var(--numa-shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--numa-accent)]">
              {isSms ? "Från bank-SMS" : "Från kvitto"}
            </p>
            <p className="mt-1 text-sm text-[var(--numa-muted)]">
              {needsManualAmount
                ? isSms
                  ? "Kunde inte läsa automatiskt — skriv beloppet som drogs (inte saldot)."
                  : "Kunde inte läsa automatiskt — skriv beloppet från bilden."
                : isSms
                  ? "Beloppet är inläst. Dubbelkolla och bekräfta."
                  : "Beloppet är inläst. Justera om det behövs."}
            </p>
          </div>
          {preview.amountFromScan && !amountEditable ? (
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-[var(--numa-accent)]"
              onClick={() => setAmountEditable(true)}
            >
              Ändra
            </button>
          ) : null}
        </div>

        <div className="mt-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            {isSms ? "Belopp som drogs" : "Belopp"}
          </p>
          {amountEditable || needsManualAmount ? (
            <input
              inputMode="decimal"
              autoFocus={needsManualAmount}
              value={preview.amount}
              onChange={(e) =>
                setPreview((p) => (p ? { ...p, amount: e.target.value } : p))
              }
              placeholder={isSms ? "t.ex. 65,00" : "0,00"}
              className="money mt-2 w-full border-0 bg-transparent p-0 text-4xl font-semibold tracking-tight outline-none placeholder:text-[var(--numa-faint)]"
              aria-label="Belopp"
              required
            />
          ) : (
            <p className="money mt-2 text-4xl font-semibold tracking-tight text-[var(--numa-ink)]">
              {preview.amount || "—"}
              <span className="ml-2 text-base font-medium text-[var(--numa-faint)]">
                {preview.currency}
              </span>
            </p>
          )}
        </div>

        {preview.balanceAfterMinor != null ? (
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-[var(--numa-bg)] px-4 py-3">
            <span className="text-sm text-[var(--numa-muted)]">
              Nytt saldo i SMS
            </span>
            <span className="money text-sm font-semibold">
              {formatMoney(money(preview.balanceAfterMinor, preview.currency))}
            </span>
          </div>
        ) : null}

        {preview.skippedOlderCount > 0 ? (
          <p className="mt-3 text-xs text-[var(--numa-faint)]">
            Hoppade över {preview.skippedOlderCount} äldre SMS i bilden.
          </p>
        ) : null}
      </div>

      {impact ? (
        <div className="rounded-[1.5rem] bg-white/70 px-5 py-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            Efter köpet
          </p>
          <p className={`mt-1 text-lg font-semibold ${remainingTone}`}>
            {impact.canAfford ? "Inom dagens trygga nivå" : "Över dagens trygga nivå"}
          </p>
          <p className={`money mt-1 text-sm ${remainingTone}`}>
            {formatMoney(money(impact.remaining, currency))} kvar
          </p>
        </div>
      ) : isSms ? (
        <p className="px-1 text-sm text-[var(--numa-muted)]">
          Bekräfta så uppdateras utgiften och saldot från banken.
        </p>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
              category === c
                ? "bg-[var(--numa-ink)] text-white"
                : "bg-white/70 text-[var(--numa-muted)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <input
        value={preview.description}
        onChange={(e) =>
          setPreview((p) => (p ? { ...p, description: e.target.value } : p))
        }
        placeholder={isSms ? "Valfritt — t.ex. 7-Eleven" : "Butik eller notis"}
        className="w-full rounded-2xl border-0 bg-white/70 px-4 py-3.5 text-sm outline-none ring-[var(--numa-accent)] focus:ring-2"
      />

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !preview.amount.trim()}
        className="flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--numa-accent)] text-[15px] font-semibold text-white shadow-[var(--numa-shadow-sm)] transition active:scale-[0.99] disabled:opacity-45"
      >
        {pending
          ? "Sparar…"
          : bootstrapping
            ? "Spara och sätt saldo"
            : "Bekräfta"}
      </button>
      <button
        type="button"
        className="w-full py-2 text-sm font-medium text-[var(--numa-muted)]"
        onClick={() => {
          URL.revokeObjectURL(preview.previewUrl);
          setPreview(null);
          setAmountEditable(false);
        }}
      >
        Ta ny bild
      </button>
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
  return (
    <div className="space-y-5 animate-rise">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Vad vill du göra?</h2>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Välj ett sätt — resten är ett steg.
        </p>
      </header>

      <div className="space-y-3">
        <ModeCard
          title="Bank-SMS"
          subtitle="Importera uttag och uppdatera saldo automatiskt"
          accent
          onClick={() => onChoose("bank_sms")}
        />
        <ModeCard
          title="Fota kvitto"
          subtitle="Läs priset från kvitto eller prislapp"
          onClick={() => onChoose("receipt")}
        />
        <ModeCard
          title="Skriv manuellt"
          subtitle={
            hasAccount
              ? "Utgift eller intäkt under dagen — utan kamera"
              : "Kräver saldo först (fota bank-SMS en gång)"
          }
          onClick={() => onChoose("manual")}
        />
      </div>

      {bootstrapping ? (
        <p className="px-1 text-xs leading-relaxed text-[var(--numa-faint)]">
          Tips: börja med Bank-SMS så Hem får rätt saldo.
        </p>
      ) : (
        <p className="px-1 text-center text-xs text-[var(--numa-faint)]">
          <Link href="/transaktioner" className="font-semibold text-[var(--numa-accent)]">
            Se utgifter & intäkter
          </Link>
        </p>
      )}
    </div>
  );
}

function ModeCard({
  title,
  subtitle,
  onClick,
  accent = false,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-start rounded-[1.5rem] px-5 py-4 text-left transition active:scale-[0.99] ${
        accent
          ? "bg-[var(--numa-ink)] text-white shadow-[var(--numa-shadow)]"
          : "bg-white/90 text-[var(--numa-ink)] shadow-[var(--numa-shadow-sm)]"
      }`}
    >
      <span className="text-[15px] font-semibold tracking-tight">{title}</span>
      <span
        className={`mt-1 text-sm leading-snug ${
          accent ? "text-white/70" : "text-[var(--numa-muted)]"
        }`}
      >
        {subtitle}
      </span>
    </button>
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-36 w-full rounded-[1.5rem] object-cover shadow-[var(--numa-shadow-sm)]"
    />
  );
}
