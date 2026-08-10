import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { authNoticeFromCode } from "@/features/auth/messages";

export const metadata: Metadata = {
  title: "Glömt lösenord — NUMA",
};

export default async function GlomtLosenordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const epost = Array.isArray(params.epost) ? params.epost[0] : params.epost;

  return (
    <ForgotPasswordForm
      initialEmail={epost ?? ""}
      initialError={authNoticeFromCode(params.fel, "reset")}
    />
  );
}
