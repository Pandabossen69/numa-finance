import { AnalysPending } from "@/components/layout/ViewLoading";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";

export default async function AnalysLoading() {
  const last = await readLastHomeCookie();
  return <AnalysPending home={last} />;
}
