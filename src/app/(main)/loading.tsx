import { MainFirstPaint } from "@/components/layout/HemFirstPaint";
import { LoadingSlot } from "@/components/layout/LoadingSlot";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";

export default async function MainLoading() {
  const cookieShell = await readLastHomeCookie();
  return (
    <LoadingSlot>
      <MainFirstPaint cookieShell={cookieShell} />
    </LoadingSlot>
  );
}
