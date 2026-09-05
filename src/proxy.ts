import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Never run auth on sw.js / icons — otherwise /sw.js returns login HTML
     * and phones cannot replace a broken service worker.
     * Also skip the Sentry tunnel and isolated Preview test route.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|sentry-tunnel|api/internal/sentry-test|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
