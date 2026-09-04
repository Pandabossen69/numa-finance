/**
 * Best-effort production error reporting.
 * When `SENTRY_DSN` is set, events go to Sentry. Always logs locally.
 */
export async function reportError(
  scope:
    | "loader.home"
    | "loader.plan"
    | "loader.analys"
    | "loader.accounts"
    | "mutation.settle"
    | "mutation.expense"
    | "mutation.link"
    | "ocr.upload"
    | "ocr.confirm"
    | "reconcile",
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[numa] ${scope}`, message, extra ?? "");

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const parsed = parseSentryDsn(dsn);
    if (!parsed) return;
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "node",
      level: "error",
      logger: "numa",
      tags: { scope },
      extra: extra ?? {},
      exception: {
        values: [
          {
            type: error instanceof Error ? error.name : "Error",
            value: message,
            stacktrace: stack
              ? { frames: [{ filename: "numa", function: scope, vars: { stack } }] }
              : undefined,
          },
        ],
      },
    };
    const url = `${parsed.ingest}/api/${parsed.projectId}/store/?sentry_key=${parsed.publicKey}&sentry_version=7`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (sendError) {
    console.error("[numa] sentry report failed", sendError);
  }
}

function parseSentryDsn(dsn: string): {
  ingest: string;
  publicKey: string;
  projectId: string;
} | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!projectId) return null;
    return {
      ingest: `${url.protocol}//${url.host}`,
      publicKey: url.username,
      projectId,
    };
  } catch {
    return null;
  }
}
