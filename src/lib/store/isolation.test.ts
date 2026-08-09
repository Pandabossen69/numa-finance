import { describe, expect, it } from "vitest";
import {
  assertUserOwnsStoragePath,
  buildUserStoragePath,
} from "./isolation";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("storage path isolation", () => {
  it("prefixes path with the owning user id", () => {
    const path = buildUserStoragePath(USER, "kvito.jpg", new Date("2026-08-09T12:00:00.000Z"));
    expect(path.startsWith(`${USER}/`)).toBe(true);
    expect(path.endsWith("kvito.jpg") || path.includes("kvito.jpg")).toBe(true);
    expect(path.includes("..")).toBe(false);
  });

  it("rejects foreign storage paths", () => {
    expect(() =>
      assertUserOwnsStoragePath(USER, `${OTHER}/file.jpg`),
    ).toThrow(/does not belong/);
  });

  it("accepts owned paths", () => {
    expect(() =>
      assertUserOwnsStoragePath(USER, `${USER}/a.jpg`),
    ).not.toThrow();
  });
});
