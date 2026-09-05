/**
 * Shared Sentry init for browser, Node, and Edge.
 * Privacy-first: no PII, financial payloads, tokens, or request bodies.
 */

import type { ErrorEvent, TransactionEvent } from "@sentry/core";

const SENSITIVE_KEY =
  /(amount|balance|saldo|iban|account|email|token|secret|password|ocr|image|body|description|payload|session|cookie|authorization|bearer|supabase|minor|currency|receipt|card|ssn|personnummer|phone|username|userid|user_id)/i;

export type SentryEnvLike = {
  SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  NODE_ENV?: string;
};

export function resolveSentryDsn(env: SentryEnvLike = process.env): string | undefined {
  const dsn = env.SENTRY_DSN?.trim() || env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return dsn || undefined;
}

export function isSentryDsnConfigured(env: SentryEnvLike = process.env): boolean {
  return Boolean(resolveSentryDsn(env));
}

export function resolveSentryEnvironment(env: SentryEnvLike = process.env): string {
  const explicit = env.SENTRY_ENVIRONMENT?.trim();
  if (explicit) return explicit;
  const vercel = env.VERCEL_ENV?.trim();
  if (vercel === "preview" || vercel === "production" || vercel === "development") {
    return vercel;
  }
  return env.NODE_ENV === "production" ? "production" : "development";
}

export function resolveSentryRelease(
  env: SentryEnvLike = process.env,
): string | undefined {
  const explicit = env.SENTRY_RELEASE?.trim();
  if (explicit) return explicit;
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return sha || undefined;
}

export function stripQueryAndFragment(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0]?.split("#")[0] ?? url;
  }
}

export function scrubRecord(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 200 ? "[truncated]" : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => scrubRecord(entry, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[filtered]" : scrubRecord(entry, depth + 1);
    }
    return out;
  }
  return "[filtered]";
}

type ScrubbableEvent = {
  user?: Record<string, unknown> | null;
  request?: {
    cookies?: unknown;
    headers?: unknown;
    data?: unknown;
    query_string?: unknown;
    url?: string;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<{ data?: Record<string, unknown> }>;
};

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  event.user = {};
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) {
      event.request.url = stripQueryAndFragment(event.request.url);
    }
  }
  if (event.extra) {
    event.extra = scrubRecord(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubRecord(event.contexts) as Record<string, unknown>;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      data: breadcrumb.data
        ? (scrubRecord(breadcrumb.data) as Record<string, unknown>)
        : undefined,
    }));
  }
  return event;
}

export function getSentryInitOptions(env: SentryEnvLike = process.env) {
  return {
    dsn: resolveSentryDsn(env),
    environment: resolveSentryEnvironment(env),
    release: resolveSentryRelease(env),
    sendDefaultPii: false,
    enableLogs: false,
    tracesSampleRate: env.NODE_ENV === "development" ? 1 : 0.1,
    dataCollection: {
      userInfo: false,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [] as [],
      httpHeaders: { request: false, response: false },
      cookies: false,
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    beforeSend(event: ErrorEvent) {
      return scrubSentryEvent(event);
    },
    beforeSendTransaction(event: TransactionEvent) {
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb: {
      category?: string;
      data?: { [key: string]: unknown };
    }) {
      if (breadcrumb.category === "console") {
        return { ...breadcrumb, data: undefined };
      }
      if (breadcrumb.data) {
        breadcrumb.data = scrubRecord(breadcrumb.data) as {
          [key: string]: unknown;
        };
      }
      return breadcrumb;
    },
  };
}
