import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Fail closed: without CRON_SECRET nobody may trigger the purge.
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const sent = Buffer.from(authorization);
  if (sent.length !== expected.length) return false;
  return timingSafeEqual(sent, expected);
}
