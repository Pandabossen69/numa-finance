/** Single-admin allowlist. Compare case-insensitively against Auth email from getUser(). */
export const NUMA_ADMIN_EMAIL = "qualityltf@gmail.com";

export function isNumaAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === NUMA_ADMIN_EMAIL;
}
