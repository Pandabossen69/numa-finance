import { signOutAction } from "@/features/auth/actions";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[var(--numa-shell-max)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 pb-2.5 pt-[max(0.85rem,var(--numa-safe-top))] md:max-w-xl md:pt-10">
        <span className="numa-brand-mark">NUMA</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="numa-press min-h-11 px-2 text-sm font-medium text-[var(--numa-muted)] transition hover:text-[var(--numa-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--numa-accent)]"
          >
            Logga ut
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-lg pb-[max(2rem,env(safe-area-inset-bottom))] pt-2 md:max-w-xl md:pt-4">
        {children}
      </main>
    </div>
  );
}
