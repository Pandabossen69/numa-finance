import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./auth";

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact Vercel Cron bearer header", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("fails closed when CRON_SECRET is missing or empty", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
  });

  it("rejects missing, wrong, or differently sized headers", () => {
    expect(isAuthorizedCronRequest(null, "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer wrong!", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer s3cret2", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("s3cret", "s3cret")).toBe(false);
  });
});
