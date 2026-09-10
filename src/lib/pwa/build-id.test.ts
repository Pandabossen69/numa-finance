import { describe, expect, it } from "vitest";
import { resolveSwBuildId } from "./build-id";

describe("resolveSwBuildId", () => {
  it("prefers the public Vercel git SHA", () => {
    expect(
      resolveSwBuildId({
        NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "abc123",
        VERCEL_GIT_COMMIT_SHA: "other",
      }),
    ).toBe("abc123");
  });

  it("treats empty strings as missing and keeps falling back", () => {
    expect(
      resolveSwBuildId({
        NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "",
        VERCEL_GIT_COMMIT_SHA: "  def456  ",
      }),
    ).toBe("def456");
  });

  it("falls back to dev when nothing is set", () => {
    expect(resolveSwBuildId({})).toBe("dev");
  });
});
