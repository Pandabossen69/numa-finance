import { describe, expect, it } from "vitest";
import { rejectPublicSignup, PUBLIC_SIGNUP_CLOSED_MESSAGE } from "./signup-policy";

describe("public signup policy", () => {
  it("rejects signup for any input", () => {
    expect(rejectPublicSignup()).toEqual({
      ok: false,
      error: PUBLIC_SIGNUP_CLOSED_MESSAGE,
    });
    expect(PUBLIC_SIGNUP_CLOSED_MESSAGE).toMatch(/NUMA/i);
  });
});
