import { LoginBootClear } from "@/components/auth/LoginBoot";
import { SignOutForm } from "@/components/auth/SignOutButton";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[var(--numa-shell-max)] flex-col overflow-x-clip pr-[max(1rem,var(--numa-safe-right))] pl-[max(1rem,var(--numa-safe-left))]">
      <LoginBootClear />
      <header className="mx-auto flex w-full max-w-lg shrink-0 items-center justify-between gap-3 pt-[max(0.85rem,var(--numa-safe-top))] pb-2.5 md:max-w-2xl md:pt-8">
        <span className="numa-brand-mark">NUMA</span>
        <SignOutForm>
          <button
            type="submit"
            className="numa-press min-h-11 px-2 text-sm font-medium text-[var(--numa-muted)] transition hover:text-[var(--numa-ink)] focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Logga ut
          </button>
        </SignOutForm>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-x-clip pt-2 pb-[max(1.25rem,var(--numa-safe-bottom))] md:max-w-2xl md:justify-center md:pt-4 md:pb-12">
        {children}
      </main>
    </div>
  );
}
