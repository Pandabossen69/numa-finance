import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import {
  getSentryInitOptions,
  isSentryDsnConfigured,
  resolveSentryEnvironment,
} from "@/lib/observe/sentry-options";
import {
  isSentryTestConfirmed,
  isSentryTestRouteEnabled,
  SENTRY_TEST_ERROR_MESSAGE,
} from "@/lib/observe/sentry-test-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function ensureSentryClient() {
  if (!Sentry.getClient()) {
    Sentry.init(getSentryInitOptions());
  }
}

function sentryStatus() {
  return {
    environment: resolveSentryEnvironment(),
    dsnConfigured: isSentryDsnConfigured(),
    clientInitialized: Boolean(Sentry.getClient()),
  };
}

/**
 * Isolated Sentry verification hook. 404 in production.
 * Preview/dev: GET /api/internal/sentry-test?confirm=1 captures + flushes
 * one unique test issue, then returns 500.
 */
export async function GET(request: Request) {
  if (!isSentryTestRouteEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  ensureSentryClient();

  const { searchParams } = new URL(request.url);
  if (!isSentryTestConfirmed(searchParams)) {
    return NextResponse.json({
      ok: true,
      hint: "Add ?confirm=1 to capture a unique test error. Preview/dev only.",
      ...sentryStatus(),
    });
  }

  const verificationId = crypto.randomUUID();
  const error = new Error(`${SENTRY_TEST_ERROR_MESSAGE} [${verificationId}]`);
  const eventId = Sentry.captureException(error, {
    fingerprint: ["numa-sentry-test", verificationId],
    tags: {
      "numa.scope": "sentry.test",
      "numa.verification": "1",
    },
  });
  const flushed = await Sentry.flush(2000);

  return NextResponse.json(
    {
      ok: false,
      captured: Boolean(eventId),
      flushed,
      eventId: eventId || null,
      verificationId,
      ...sentryStatus(),
    },
    { status: 500 },
  );
}
