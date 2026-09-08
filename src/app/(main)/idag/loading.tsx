import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemPending } from "@/components/layout/ViewLoading";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";

export default async function IdagLoading() {
  const last = await readLastHomeCookie();
  if (last) return <HomeDashboard snap={last} error={null} />;
  return <HemPending />;
}
