import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { MerScreen } from "@/components/mer/MerScreen";
import { MerViewLoading } from "@/components/mer/MerViewLoading";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { withTimeout } from "@/lib/async";
import { getProfile } from "@/lib/store/repository";
import { currentUserIsNumaAdmin } from "@/features/auth/session";

const MER_TIMEOUT_MS = 3_000;

export const dynamic = "force-dynamic";

export default function MerPage() {
  return (
    <Suspense fallback={<MerViewLoading />}>
      <MerBody />
    </Suspense>
  );
}

async function MerBody() {
  const [profileResult, isAdmin] = await Promise.all([
    withTimeout(getProfile(), MER_TIMEOUT_MS, "merProfile")
      .then((profile) => ({ ok: true as const, profile }))
      .catch((error) => {
        unstable_rethrow(error);
        console.error("[numa] mer profile failed", error);
        return { ok: false as const, profile: null };
      }),
    withTimeout(currentUserIsNumaAdmin(), MER_TIMEOUT_MS, "merAdmin").catch(
      () => false,
    ),
  ]);
  if (!profileResult.profile) {
    return <MerScreen data={null} />;
  }

  return (
    <MerScreen
      data={{
        userId: profileResult.profile.id,
        displayName: chromeDisplayName(profileResult.profile.displayName),
        isAdmin,
      }}
    />
  );
}
