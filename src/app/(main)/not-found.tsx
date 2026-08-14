import Link from "next/link";

export default function MainNotFound() {
  return (
    <div className="space-y-4 pt-8 pb-4">
      <h1 className="text-[1.65rem] font-semibold tracking-tight">Sidan finns inte</h1>
      <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
        Gå tillbaka till Hem — där ser du hur mycket som är kvar idag.
      </p>
      <Link
        href="/idag"
        className="inline-flex min-h-12 items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
      >
        Till Hem
      </Link>
    </div>
  );
}
