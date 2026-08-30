import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { MerScreen } from "@/components/mer/MerScreen";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { getProfile } from "@/lib/store/repository";
import { currentUserIsNumaAdmin } from "@/features/auth/session";

export default function MerPage() {
  return (
    <Suspense fallback={<MerScreen data={null} />}>
      <MerBody />
    </Suspense>
  );
}

async function MerBody() {
  const [profileResult, isAdmin] = await Promise.all([
    getProfile()
      .then((profile) => ({ ok: true as const, profile }))
      .catch((error) => {
        unstable_rethrow(error);
        console.error("[numa] mer profile failed", error);
        return { ok: false as const, profile: null };
      }),
    currentUserIsNumaAdmin(),
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
