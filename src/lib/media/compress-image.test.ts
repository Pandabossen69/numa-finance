import { describe, expect, it, vi } from "vitest";
import { ImagePrepareError, browserDecodesHeic, compressImageForUpload, heicMimeOrName } from "./compress-image";
import { IMAGE_UNREADABLE_SV } from "./upload-limits";

describe("HEIC upload", () => {
  it("recognises HEIC by mime or file name", () => {
    expect(heicMimeOrName({ type: "image/heic", name: "a.jpg" })).toBe(true);
    expect(heicMimeOrName({ type: "", name: "kvitto.HEIC" })).toBe(true);
    expect(heicMimeOrName({ type: "image/jpeg", name: "a.jpg" })).toBe(false);
  });

  it("does not try to decode HEIC in Chrome", () => {
    expect(
      browserDecodesHeic(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
    expect(
      browserDecodesHeic(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("fails quietly instead of calling createImageBitmap", async () => {
    const bitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
    });
    const file = new File([new Uint8Array([1, 2, 3])], "kvitto.heic", {
      type: "image/heic",
    });
    await expect(compressImageForUpload(file)).rejects.toBeInstanceOf(ImagePrepareError);
    await expect(compressImageForUpload(file)).rejects.toThrow(IMAGE_UNREADABLE_SV);
    expect(bitmap).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
