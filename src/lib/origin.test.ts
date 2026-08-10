import { describe, expect, it } from "vitest";
import { normalizeOrigin, originFromHeaders } from "./origin";

function headers(map: Record<string, string>) {
  return (name: string) => map[name] ?? null;
}

describe("normalizeOrigin", () => {
  it("keeps a full url origin", () => {
    expect(normalizeOrigin("https://numa.app/nagot")).toBe("https://numa.app");
  });

  it("assumes https for a bare host", () => {
    expect(normalizeOrigin("numa.vercel.app")).toBe("https://numa.vercel.app");
  });

  it("returns null for empty or broken values", () => {
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin("http://")).toBeNull();
  });
});

describe("originFromHeaders", () => {
  it("prefers the forwarded host and protocol", () => {
    const origin = originFromHeaders(
      headers({
        "x-forwarded-host": "numa.app",
        "x-forwarded-proto": "https",
        host: "internal:3000",
      }),
    );
    expect(origin).toBe("https://numa.app");
  });

  it("uses http for local hosts without a forwarded protocol", () => {
    expect(originFromHeaders(headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("takes the first entry of comma separated proxy headers", () => {
    expect(
      originFromHeaders(
        headers({
          "x-forwarded-host": "numa.app, internal.local",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://numa.app");
  });

  it("returns null without a host header", () => {
    expect(originFromHeaders(headers({}))).toBeNull();
  });
});
