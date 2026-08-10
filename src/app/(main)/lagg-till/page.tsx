import { redirect } from "next/navigation";

/** Canonical add hub lives on /fota with clear mode picker. */
export default async function LaggTillPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const mode = params.mode;
  const q =
    mode === "manual" || mode === "sms" || mode === "kvitto"
      ? `?mode=${mode}`
      : "";
  redirect(`/fota${q}`);
}
