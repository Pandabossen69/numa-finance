import { LoginForm } from "@/components/auth/LoginForm";

export default function LoggaInPage() {
  return (
    <div className="numa-shell flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="animate-rise mx-auto w-full max-w-md space-y-8">
        <header className="space-y-2">
          <p className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</p>
          <h1 className="text-2xl font-semibold tracking-tight">Välkommen</h1>
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            Logga in för att synka ditt saldo och dina utgifter säkert.
          </p>
        </header>
        <LoginForm />
      </div>
    </div>
  );
}
