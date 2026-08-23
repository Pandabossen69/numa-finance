import {
  EMAIL_INVALID_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  isPlausibleEmail,
  swedishEmailConstraintMessage,
} from "./email";
import { describe, expect, it } from "vitest";

describe("isPlausibleEmail", () => {
  it("accepts a normal address", () => {
    expect(isPlausibleEmail("namn@mail.com")).toBe(true);
  });

  it("rejects missing @", () => {
    expect(isPlausibleEmail("notanemail")).toBe(false);
  });

  it("rejects empty or whitespace", () => {
    expect(isPlausibleEmail("")).toBe(false);
    expect(isPlausibleEmail("   ")).toBe(false);
  });

  it("rejects spaces around a valid-looking address", () => {
    expect(isPlausibleEmail("namn @mail.com")).toBe(false);
  });
});

describe("swedishEmailConstraintMessage", () => {
  it("returns required copy when the field is empty", () => {
    expect(
      swedishEmailConstraintMessage({
        valueMissing: true,
        typeMismatch: false,
      }),
    ).toBe(EMAIL_REQUIRED_MESSAGE);
  });

  it("returns Swedish format copy on type mismatch", () => {
    expect(
      swedishEmailConstraintMessage({
        valueMissing: false,
        typeMismatch: true,
      }),
    ).toBe(EMAIL_INVALID_MESSAGE);
  });

  it("returns no message when the value is valid", () => {
    expect(
      swedishEmailConstraintMessage({
        valueMissing: false,
        typeMismatch: false,
      }),
    ).toBe("");
  });
});
