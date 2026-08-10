import { AuthExperience } from "@/components/auth/AuthExperience";
import { authNoticeFromCode } from "@/features/auth/messages";

export default async function LoggaInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notice = authNoticeFromCode(params.fel, "login");

  return (
    <AuthExperience
      initialScreen={notice ? "login" : "welcome"}
      initialError={notice}
    />
  );
}
