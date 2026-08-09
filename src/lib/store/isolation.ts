/**
 * Multi-user isolation helpers.
 * Storage RLS expects the first path folder to equal auth.uid().
 */

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export function buildUserStoragePath(
  userId: string,
  fileName: string,
  now: Date = new Date(),
): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error("Invalid user id for storage path");
  }

  const base = fileName.split(/[/\\]/).pop() ?? "upload.bin";
  const cleaned =
    base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload.bin";
  if (!SAFE_SEGMENT.test(cleaned)) {
    throw new Error("Invalid file name for storage path");
  }
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `${userId}/${stamp}-${cleaned}`;
}

export function assertUserOwnsStoragePath(
  userId: string,
  storagePath: string,
): void {
  const prefix = `${userId}/`;
  if (!storagePath.startsWith(prefix)) {
    throw new Error("Storage path does not belong to the authenticated user");
  }
  if (storagePath.includes("..")) {
    throw new Error("Invalid storage path");
  }
}

/** Local JSON store is single-tenant/dev-only — never for multi-user production. */
export function assertMultiUserSafeBackend(isSupabase: boolean): void {
  const onVercel = Boolean(process.env.VERCEL);
  const isProd = process.env.NODE_ENV === "production";
  if ((onVercel || isProd) && !isSupabase) {
    throw new Error(
      "Production requires Supabase for multi-user isolation. Local JSON store is dev-only.",
    );
  }
}
