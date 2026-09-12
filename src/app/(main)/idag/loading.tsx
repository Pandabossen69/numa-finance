import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { LoadingSlot } from "@/components/layout/LoadingSlot";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";

export default async function IdagLoading() {
  const cookieShell = await readLastHomeCookie();
  return (
    <LoadingSlot>
      <HemFirstPaint cookieShell={cookieShell} />
    </LoadingSlot>
  );
}
