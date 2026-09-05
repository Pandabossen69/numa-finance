/**
 * Best-effort production error reporting.
 * When the Sentry SDK is initialized (via `SENTRY_DSN`), events go to Sentry.
 * Always logs locally. Extra is allowlisted so financial/PII payloads stay out.
 */

import * as Sentry from "@sentry/nextjs";

export type ReportScope =
  | "loader.home"
  | "loader.plan"
  | "loader.analys"
  | "loader.accounts"
  | "mutation.settle"
  | "mutation.expense"
  | "mutation.link"
  | "mutation.refresh"
  | "ocr.upload"
  | "ocr.confirm"
  | "reconcile";

const ALLOWED_EXTRA_KEYS = new Set(["itemId", "digest", "route", "status"]);

export function sanitizeReportExtra(
  extra?: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined {
  if (!extra) return undefined;
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (!ALLOWED_EXTRA_KEYS.has(key)) continue;
    if (typeof value === "boolean") {
      safe[key] = value;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
      continue;
    }
    if (typeof value === "string" && value.length > 0 && value.length <= 80) {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function reportError(
  scope: ReportScope,
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[numa] ${scope}`, message, extra ?? "");

  try {
    const safeExtra = sanitizeReportExtra(extra);
    Sentry.withScope((current) => {
      current.setTag("numa.scope", scope);
      if (safeExtra) {
        current.setContext("numa", safeExtra);
      }
      Sentry.captureException(toError(error));
    });
  } catch (sendError) {
    console.error("[numa] sentry report failed", sendError);
  }
}
