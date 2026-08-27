import { signOutAction } from "@/features/auth/actions";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[var(--numa-shell-max)] flex-col overflow-x-hidden pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
      <header className="mx-auto flex w-full max-w-lg shrink-0 items-center justify-between gap-3 pb-2.5 pt-[max(0.85rem,var(--numa-safe-top))] md:max-w-2xl md:pt-8">
        <span className="numa-brand-mark">NUMA</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="numa-press min-h-11 px-2 text-sm font-medium text-[var(--numa-muted)] transition hover:text-[var(--numa-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
          >
            Logga ut
          </button>
        </form>
      </header>
      <main className="mx-auto flex w-full min-h-0 max-w-lg flex-1 flex-col overflow-x-hidden pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-2 md:max-w-2xl md:justify-center md:pb-12 md:pt-4">
        {children}
      </main>
    </div>
  );
}
