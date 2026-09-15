import { describe, expect, it } from "vitest";
import {
  assertAllowedImageBytes,
  ExpectedImageValidationError,
  IMAGE_MIME_MISMATCH_SV,
  INVALID_IMAGE_SV,
  isExpectedImageValidationError,
  sniffImageMime,
} from "./image-magic";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("image magic bytes", () => {
  it("accepts JPEG and PNG signatures", () => {
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(png)).toBe("image/png");
  });

  it("rejects a renamed text file as expected image validation", () => {
    const fake = new TextEncoder().encode("not an image!!");
    expect(sniffImageMime(fake)).toBeNull();
    expect(() => assertAllowedImageBytes(fake, "image/jpeg")).toThrow(
      ExpectedImageValidationError,
    );
    try {
      assertAllowedImageBytes(fake, "image/jpeg");
    } catch (error) {
      expect(isExpectedImageValidationError(error)).toBe(true);
      expect(error).toMatchObject({ message: INVALID_IMAGE_SV });
    }
  });

  it("rejects a MIME/content mismatch as expected image validation", () => {
    expect(() => assertAllowedImageBytes(jpeg, "image/png")).toThrow(
      ExpectedImageValidationError,
    );
    try {
      assertAllowedImageBytes(jpeg, "image/png");
    } catch (error) {
      expect(isExpectedImageValidationError(error)).toBe(true);
      expect(error).toMatchObject({ message: IMAGE_MIME_MISMATCH_SV });
    }
  });

  it("does not treat unexpected runtime errors as image validation", () => {
    expect(isExpectedImageValidationError(new Error("storage timeout"))).toBe(
      false,
    );
    expect(isExpectedImageValidationError(new TypeError("bytes is undefined"))).toBe(
      false,
    );
  });
});
