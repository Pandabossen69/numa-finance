"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";
import {
  createExpenseAction,
  setAvailableNowAction,
} from "@/features/finance/actions";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { homeGreeting } from "@/features/home/mock-snapshot";

export function HomeDashboard({
  snap,
  error,
}: {
  snap: HomeSnapshot | null;
  error?: string | null;
}) {
  if (error || !snap) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <Link href="/fota" className="text-sm font-semibold text-[var(--numa-accent)]">
          Gå till Fota →
        </Link>
      </div>
    );
  }

  const currency = snap.currency;
  const greeting = homeGreeting();
  const isBridge = snap.livingMode === "bridge";
  const isEmpty = snap.livingMode === "empty";
  const remainingOk = snap.remainingFreeMinor >= 0;
  const dayOk = snap.perDayBudgetMinor > 0;
  const rangeLabel = isBridge
    ? snap.nextIncomeLabelSv
      ? `tills ${snap.nextIncomeLabelSv}`
      : null
    : snap.cycleStartLabelSv && snap.cycleEndLabelSv
      ? `${snap.cycleStartLabelSv} → ${snap.cycleEndLabelSv}`
      : null;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="animate-rise">
        <p className="text-sm font-medium capitalize text-[var(--numa-muted)]">
          {greeting}
          {rangeLabel ? ` · ${rangeLabel}` : ""}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Hem
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-[var(--numa-muted)]">
          {isEmpty
            ? "Lägg in intäkter med datum i Plan."
            : isBridge
              ? "Du lever på det som finns kvar på kontot tills nästa intäkt."
              : "Så mycket du får leva på varje dag just nu."}
        </p>
      </header>

      {snap.needsAvailableInput ? (
        <AvailableNowCard
          accountId={snap.primaryAccountId}
          currency={currency}
          nextIncomeLabel={snap.nextIncomeLabelSv}
        />
      ) : null}

      {!snap.needsAvailableInput ? (
        <>
          <section
            className="animate-rise-delay-1 space-y-1.5"
            aria-labelledby="spend-heading"
          >
            <p
              id="spend-heading"
              className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]"
            >
              Kvar per dag
            </p>
            <div
              className={
                dayOk ? "text-[var(--numa-ink)]" : "text-[var(--numa-muted)]"
              }
            >
              <MoneyDisplay
                amountMinor={Math.max(0, snap.perDayBudgetMinor)}
                currency={currency}
                size="xl"
              />
            </div>
            <p className="text-sm text-[var(--numa-muted)]">
              {isEmpty
                ? "Öppna Plan och lägg till lön eller CSN."
                : isBridge
                  ? `${snap.spendDaysLeft} dagar till nästa intäkt${
                      snap.nextIncomeLabelSv ? ` (${snap.nextIncomeLabelSv})` : ""
                    }`
                  : `${snap.spendDaysLeft} dagar kvar${
                      snap.cycleEndInferred ? " · slutdatum beräknat" : ""
                    }`}
            </p>
          </section>

          <section className="animate-rise-delay-2 space-y-0">
            <OverviewRow
              label={isBridge ? "Kvar på kontot" : "Kvar totalt"}
              amountMinor={snap.remainingFreeMinor}
              currency={currency}
              tone={remainingOk ? "positive" : "danger"}
            />
            {!isBridge ? (
              <OverviewRow
                label="Sparar"
                amountMinor={snap.planSavingsMinor}
                currency={currency}
              />
            ) : null}
            {snap.hasBankTruth &&
            snap.calculatedBalanceMinor != null &&
            !(isBridge && snap.usesBankBalance) ? (
              <OverviewRow
                label="Saldo"
                amountMinor={snap.calculatedBalanceMinor}
                currency={currency}
                hint={snap.verificationLabel ?? undefined}
              />
            ) : null}
            {!isBridge && snap.cycleSpendingMinor > 0 ? (
              <OverviewRow
                label="Spenderat"
                amountMinor={snap.cycleSpendingMinor}
                currency={currency}
              />
            ) : null}
          </section>

          {isBridge ? (
            <p className="text-sm text-[var(--numa-muted)]">
              När du fotar kvitto eller uppdaterar saldo räknas dagsbudgeten om
              automatiskt.{" "}
              <Link href="/fota" className="font-semibold text-[var(--numa-accent)]">
                Fota
              </Link>
              {" · "}
              <UpdateBalanceLink
                accountId={snap.primaryAccountId}
                currency={currency}
              />
            </p>
          ) : null}

          <QuickExpense
            accountId={snap.primaryAccountId}
            currency={currency}
            disabled={!snap.primaryAccountId}
          />
        </>
      ) : null}

      <p className="animate-rise-delay-3 text-center text-sm text-[var(--numa-muted)]">
        <Link href="/plan" prefetch className="font-semibold text-[var(--numa-accent)]">
          Planera månader
        </Link>
        {" · "}
        <Link href="/transaktioner" prefetch className="font-semibold text-[var(--numa-accent)]">
          Alla rörelser
        </Link>
      </p>
    </div>
  );
}

function AvailableNowCard({
  accountId,
  currency,
  nextIncomeLabel,
}: {
  accountId: string | null;
  currency: CurrencyCode;
  nextIncomeLabel: string | null;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="numa-panel-strong animate-rise-delay-1 space-y-4 p-5">
      <div>
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
          Kom igång
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          Hur mycket har du kvar på kontot?
        </h2>
        <p className="mt-1 max-w-[40ch] text-sm text-[var(--numa-muted)]">
          Pengarna från förra månaden. Vi delar upp dem per dag
          {nextIncomeLabel ? ` tills ${nextIncomeLabel}` : " tills nästa intäkt"}
          . Utgifter som redan är betalda behöver du inte lägga in igen.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder={`Belopp (${currency})`}
          className="money min-h-12 flex-1 rounded-xl border border-[var(--numa-border)] bg-white/80 px-4 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
        />
        <button
          type="button"
          disabled={pending || !balance.trim()}
          className="min-h-12 rounded-xl bg-[var(--numa-ink)] px-5 text-sm font-semibold text-white disabled:opacity-45"
          onClick={() => {
            startTransition(async () => {
              const result = await setAvailableNowAction({
                balance,
                accountId,
                currency,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(null);
              router.refresh();
            });
          }}
        >
          {pending ? "Sparar…" : "Spara och visa budget"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function UpdateBalanceLink({
  accountId,
  currency,
}: {
  accountId: string | null;
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        className="font-semibold text-[var(--numa-accent)]"
        onClick={() => setOpen(true)}
      >
        Uppdatera belopp
      </button>
    );
  }

  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <input
        inputMode="decimal"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        placeholder={currency}
        className="money min-h-9 w-28 rounded-lg border border-[var(--numa-border)] bg-white/80 px-2 text-sm font-semibold"
      />
      <button
        type="button"
        disabled={pending || !balance.trim()}
        className="text-sm font-semibold text-[var(--numa-accent)] disabled:opacity-45"
        onClick={() => {
          startTransition(async () => {
            const result = await setAvailableNowAction({
              balance,
              accountId,
              currency,
            });
            if (result.ok) {
              setOpen(false);
              setBalance("");
              router.refresh();
            }
          });
        }}
      >
        Spara
      </button>
      <button
        type="button"
        className="text-sm text-[var(--numa-muted)]"
        onClick={() => setOpen(false)}
      >
        Avbryt
      </button>
    </span>
  );
}

function OverviewRow({
  label,
  amountMinor,
  currency,
  hint,
  tone,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  hint?: string;
  tone?: "positive" | "danger";
}) {
  const amountClass =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "text-[var(--numa-ink)]";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--numa-border)] pb-3">
      <div className="min-w-0">
        <p className="text-sm text-[var(--numa-muted)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-[var(--numa-faint)]">{hint}</p>
        ) : null}
      </div>
      <div className={`shrink-0 ${amountClass}`}>
        <MoneyDisplay amountMinor={amountMinor} currency={currency} size="md" />
      </div>
    </div>
  );
}

function QuickExpense({
  accountId,
  currency,
  disabled,
}: {
  accountId: string | null;
  currency: CurrencyCode;
  disabled: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="numa-panel animate-rise-delay-2 space-y-3 p-4">
      <h2 className="text-sm font-semibold tracking-tight text-[var(--numa-muted)]">
        Snabb utgift
      </h2>

      {disabled ? (
        <p className="text-sm text-[var(--numa-muted)]">
          Behöver ett konto —{" "}
          <Link href="/fota" className="font-semibold text-[var(--numa-accent)]">
            fota SMS
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_7.5rem_auto]">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="t.ex. Lunch, Grab"
              className="min-h-11 rounded-xl border border-[var(--numa-border)] bg-white/80 px-3 text-sm outline-none focus:border-[var(--numa-accent)]"
            />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={currency}
              className="money min-h-11 rounded-xl border border-[var(--numa-border)] bg-white/80 px-3 text-sm font-semibold outline-none focus:border-[var(--numa-accent)]"
            />
            <button
              type="button"
              disabled={pending || !amount.trim()}
              className="min-h-11 rounded-xl bg-[var(--numa-ink)] px-4 text-sm font-semibold text-white disabled:opacity-45"
              onClick={() => {
                if (!accountId) return;
                startTransition(async () => {
                  const result = await createExpenseAction({
                    accountId,
                    amount,
                    description: note.trim() || "Utgift",
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setError(null);
                  setAmount("");
                  setNote("");
                  router.refresh();
                });
              }}
            >
              {pending ? "…" : "Lägg till"}
            </button>
          </div>
          {error ? (
            <p className="text-sm text-[var(--numa-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
