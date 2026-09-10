/**
 * Resolve a non-empty deploy stamp for the service worker.
 * Empty strings from Vercel system env must not fall through `??` and stick
 * on "" — that would make every SW byte-identical and block updates.
 */
export function resolveSwBuildId(
  env: Record<string, string | undefined> = process.env,
): string {
  const candidates = [
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    env.VERCEL_GIT_COMMIT_SHA,
    env.NEXT_PUBLIC_NUMA_BUILD_ID,
    env.NUMA_BUILD_ID,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "dev";
}
