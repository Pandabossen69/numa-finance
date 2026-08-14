import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  PRODUCTION_ORIGIN,
  shouldRedirectToProduction,
} from "@/lib/site";
import { supabaseServerOptions } from "./options";

const PUBLIC_PATHS = ["/logga-in", "/auth", "/laga"];

const AUTH_TIMEOUT_MS = 2_500;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("auth-token") ||
        (c.name.startsWith("sb-") && c.value.length > 0),
    );
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function redirectToLogin(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/logga-in";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

function redirectToProduction(request: NextRequest) {
  const dest = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    PRODUCTION_ORIGIN,
  );
  return NextResponse.redirect(dest, 308);
}

export async function updateSession(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (shouldRedirectToProduction(host, request.nextUrl.searchParams)) {
    return redirectToProduction(request);
  }

  let supabaseResponse = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Fail closed on protected routes when auth cannot be verified.
    if (!isPublic) return redirectToLogin(request);
    return supabaseResponse;
  }

  // Fast path: no auth cookie → skip network round-trip to Supabase.
  if (!hasSupabaseAuthCookie(request)) {
    if (!isPublic) return redirectToLogin(request);
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    ...supabaseServerOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const result = await withTimeout(
      supabase.auth.getUser(),
      AUTH_TIMEOUT_MS,
      "proxy auth.getUser",
    );
    user = result.data.user;
  } catch (error) {
    console.error("[numa] proxy auth failed", error);
    // Fail closed: cookie present but session unverifiable.
    if (!isPublic) return redirectToLogin(request);
    return supabaseResponse;
  }

  if (!user && !isPublic) {
    return redirectToLogin(request);
  }

  if (user && pathname === "/logga-in") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/idag";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Legacy /lista → Rörelser. "/" → Hem.
  if (user && pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/idag";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }
  if (user && pathname === "/lista") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/transaktioner";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
