import { describe, expect, it } from "vitest";
import { assertAllowedImageBytes, sniffImageMime } from "./image-magic";

describe("image magic bytes", () => {
  it("accepts JPEG and PNG signatures", () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      "image/jpeg",
    );
    expect(
      sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])),
    ).toBe("image/png");
  });

  it("rejects a renamed text file", () => {
    const fake = new TextEncoder().encode("not an image!!");
    expect(sniffImageMime(fake)).toBeNull();
    expect(() => assertAllowedImageBytes(fake, "image/jpeg")).toThrow(/giltig bild/);
  });
});
