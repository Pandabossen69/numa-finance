import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { getTodaySnapshot } from "@/lib/store/repository";

export default async function PlanPage() {
  const snap = await getTodaySnapshot();

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-2">
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Plan</h1>
        <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          När du angett ditt saldo visar Plan hur mycket som är ledigt idag och
          den här veckan.
        </p>
        <Link href="/idag" className="text-sm font-medium text-[var(--numa-accent)]">
          Ange mitt saldo →
        </Link>
      </div>
    );
  }

  const buckets = [
    {
      title: "Tryggt idag",
      body: "Det du kan använda utan att knuffa månaden ur balans.",
      amount: snap.safeToSpendTodayMinor,
    },
    {
      title: "Tryggt denna vecka",
      body: "Ungefärlig veckoram baserad på samma beräkning.",
      amount: snap.safeToSpendWeekMinor,
    },
    {
      title: "Redan använt idag",
      body: "Bekräftade utgifter sedan midnatt i din tidszon.",
      amount: snap.todaySpendingMinor,
    },
    {
      title: "Den här månaden",
      body: "Summa bekräftade utgifter hittills i månaden.",
      amount: snap.monthSpendingMinor,
    },
  ];

  return (
    <div className="space-y-6 pt-2">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Plan</h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          En enkel bild av vad som är ledigt — innan du lägger till fasta
          hinkar och reserver.
        </p>
      </header>

      <ul className="space-y-5">
        {buckets.map((item) => (
          <li key={item.title} className="border-t border-[var(--numa-border)] pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{item.title}</h2>
                <p className="mt-1 text-sm text-[var(--numa-muted)]">{item.body}</p>
              </div>
              <MoneyDisplay
                amountMinor={item.amount}
                currency={snap.currency}
                size="md"
                compact
              />
            </div>
          </li>
        ))}
      </ul>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-5">
        <h2 className="font-medium">Kommande hinkar</h2>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Måste betalas, vardag, flexibelt, mål och buffert byggs in här — tills
          dess räknas allt ledigt utrymme som tryggt att spendera.
        </p>
        <Link href="/fota" className="inline-block text-sm font-medium text-[var(--numa-accent)]">
          Fota ett kvitto mot planen →
        </Link>
      </section>
    </div>
  );
}
