import { NextResponse } from "next/server";
import {
  isSentryTestConfirmed,
  isSentryTestRouteEnabled,
  SENTRY_TEST_ERROR_MESSAGE,
} from "@/lib/observe/sentry-test-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Isolated Sentry verification hook. 404 in production.
 * Preview/dev: GET /api/internal/sentry-test?confirm=1 throws one test error.
 */
export async function GET(request: Request) {
  if (!isSentryTestRouteEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (!isSentryTestConfirmed(searchParams)) {
    return NextResponse.json({
      ok: true,
      hint: "Add ?confirm=1 to throw a test error. Preview/dev only.",
    });
  }

  throw new Error(SENTRY_TEST_ERROR_MESSAGE);
}
