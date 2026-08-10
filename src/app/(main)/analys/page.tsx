import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MonthNav } from "@/components/transactions/MonthNav";
import {
  buildMonthSummary,
  monthOutcomeCopy,
  parseMonthKey,
} from "@/domain/finance";
import { listTransactions } from "@/lib/store/repository";
import { safeLoadTodaySnapshot } from "@/lib/store/load-snapshot";

export default async function AnalysPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const params = await searchParams;
  const loaded = await safeLoadTodaySnapshot();
  if (!loaded.ok) {
    return (
      <div className="space-y-4 pt-6 text-[var(--numa-ink)]">
        <h1 className="text-2xl font-semibold tracking-tight">
          Kunde inte ladda analys
        </h1>
        <p className="text-sm text-[var(--numa-muted)]">
          Ladda om sidan. Om det kvarstår, logga ut och in igen.
        </p>
        <a
          href="/idag"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
        >
          Till Idag
        </a>
      </div>
    );
  }
  const snap = loaded.snap;

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-2 text-[var(--numa-ink)]">
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          Analys
        </h1>
        <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Här följer du hur månaderna går — plus eller minus — när saldot är på
          plats.
        </p>
        <Link
          href="/idag"
          className="text-sm font-medium text-[var(--numa-accent)]"
        >
          Ange mitt saldo →
        </Link>
      </div>
    );
  }

  const transactions = await listTransactions(snap.primaryAccount.id);
  const monthKey = parseMonthKey(params.m, snap.profile.timezone);
  const summary = buildMonthSummary({
    transactions,
    monthKey,
    currency: snap.currency,
    timezone: snap.profile.timezone,
  });

  const room = snap.dayPlanMinor - snap.todaySpendingMinor;
  const todayLine =
    room < 0
      ? "Idag ligger du över tryggt belopp — imorgon är en ny chans."
      : room === 0
        ? "Idag ligger du exakt på planen."
        : "Idag finns det fortfarande utrymme kvar.";

  return (
    <div className="space-y-6 pt-2 pb-4 text-[var(--numa-ink)]">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          Analys
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Följ din riktning — dag för dag och månad för månad.
        </p>
      </header>

      <MonthNav
        monthKey={summary.monthKey}
        label={summary.labelSv}
        basePath="/analys"
      />

      <section className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-4">
        <p className="text-sm font-medium">Månadens läge</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          {monthOutcomeCopy(summary)}
        </p>
        <div className="grid grid-cols-3 gap-3 pt-1">
          <Mini label="Ut" amount={summary.spending.amountMinor} currency={snap.currency} />
          <Mini label="In" amount={summary.income.amountMinor} currency={snap.currency} />
          <Mini label="Netto" amount={summary.net.amountMinor} currency={snap.currency} />
        </div>
        <Link
          href={`/transaktioner?m=${summary.monthKey}`}
          className="inline-flex text-sm font-medium text-[var(--numa-accent)]"
        >
          Öppna månadens rörelser →
        </Link>
      </section>

      <section className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] px-4 py-4">
        <p className="text-sm font-medium">Just nu (idag)</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          {todayLine}
        </p>
        <div className="space-y-2">
          <Row label="Tryggt idag">
            <MoneyDisplay
              amountMinor={snap.safeToSpendTodayMinor}
              currency={snap.currency}
              size="md"
              compact
            />
          </Row>
          <Row label="Använt idag">
            <MoneyDisplay
              amountMinor={snap.todaySpendingMinor}
              currency={snap.currency}
              size="md"
              compact
            />
          </Row>
          <Row label="Kvar av dagens plan">
            <MoneyDisplay
              amountMinor={room}
              currency={snap.currency}
              size="md"
              compact
            />
          </Row>
        </div>
      </section>

      {snap.progress ? (
        <section className="space-y-2 border-t border-[var(--numa-border)] pt-5">
          <h2 className="font-medium">Din disciplin</h2>
          <p className="text-sm text-[var(--numa-muted)]">
            Streak {snap.progress.currentStreak} · {snap.progress.onTrackDays}{" "}
            dagar i fas · nivå {snap.progress.level}
          </p>
          <p className="text-sm text-[var(--numa-faint)]">
            Det handlar om hur konsekvent du håller dig till din egen plan — inte
            hur mycket pengar du har.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Mini({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: number;
  currency: "THB" | "SEK";
}) {
  return (
    <div>
      <p className="text-[11px] text-[var(--numa-faint)]">{label}</p>
      <div className="mt-1">
        <MoneyDisplay
          amountMinor={amount}
          currency={currency}
          size="sm"
          compact
        />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--numa-muted)]">{label}</span>
      {children}
    </div>
  );
}
