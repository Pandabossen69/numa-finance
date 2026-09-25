import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config } from "@/proxy";
import { updateSession } from "./middleware";

const ORIGIN = "https://numa-finance.vercel.app";
const saved = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

afterEach(() => {
  process.env = { ...saved };
});

function request(path: string) {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: {
      host: "numa-finance.vercel.app",
      authorization: "Bearer cron-secret",
    },
  });
}

describe("proxy and Vercel Cron", () => {
  it("runs the proxy on the cron route (so the bypass must live in updateSession)", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/api/cron/purge-observations")).toBe(true);
  });

  it("lets cron requests without a session reach the route", async () => {
    const res = await updateSession(request("/api/cron/purge-observations"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets bank-mail ingest through without a session", async () => {
    const res = await updateSession(request("/api/import/bank-mail"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still sends other session-less requests to /logga-in", async () => {
    for (const path of [
      "/idag",
      "/api/numa-media",
      "/api/import/other",
      "/api/cron",
      "/api/cron-x",
      "/api/cronjobs",
      "/api/cron/other",
    ]) {
      const res = await updateSession(request(path));
      expect(res.status, path).toBe(307);
      expect(res.headers.get("location"), path).toBe(`${ORIGIN}/logga-in`);
    }
  });
});
