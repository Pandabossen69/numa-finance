/**
 * Isolated Preview/dev-only Sentry verification gate.
 * Production always stays closed.
 */

export type SentryTestEnv = {
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  SENTRY_TEST_ROUTE?: string;
};

export function isSentryTestRouteEnabled(env: SentryTestEnv = process.env): boolean {
  if (env.SENTRY_TEST_ROUTE === "0") return false;
  if (env.VERCEL_ENV === "production") return false;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") {
    return true;
  }
  return env.NODE_ENV !== "production";
}

export function isSentryTestConfirmed(searchParams: URLSearchParams): boolean {
  return searchParams.get("confirm") === "1";
}

export const SENTRY_TEST_ERROR_MESSAGE =
  "NUMA Sentry verification error (preview/dev only)";
