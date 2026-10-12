import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { INVITE_ONLY_TITLE } from "@/features/auth/password-reset";

export function InviteOnly() {
  return (
    <AuthCard title={INVITE_ONLY_TITLE}>
      <p className="auth-access-note">
        <Link href="/logga-in" className="auth-text-link">
          Logga in
        </Link>
      </p>
    </AuthCard>
  );
}
