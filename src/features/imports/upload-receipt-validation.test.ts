import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extract: vi.fn(),
  report: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/store/repository", () => ({
  uploadReceiptAndExtract: mocks.extract,
}));
vi.mock("@/lib/observe/report", () => ({ reportError: mocks.report }));

import { uploadReceiptAction } from "./actions";
import { LIVE_MOVEMENT_ALREADY_SAVED_SV } from "@/domain/imports/candidate-reuse";
import {
  IMAGE_MIME_MISMATCH_SV,
  INVALID_IMAGE_SV,
} from "@/lib/media/image-magic";

const jpegBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

function formWithFile(bytes: Uint8Array, type: string) {
  const fd = new FormData();
  fd.set("file", new File([Buffer.from(bytes)], "kvitto.jpg", { type }));
  return fd;
}

describe("uploadReceiptAction image validation vs OCR errors", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns Swedish copy for an invalid image without reporting ocr.upload", async () => {
    const fake = new TextEncoder().encode("not an image!!");
    const result = await uploadReceiptAction(formWithFile(fake, "image/jpeg"));

    expect(result).toEqual({ ok: false, error: INVALID_IMAGE_SV });
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("returns Swedish copy for MIME mismatch without reporting ocr.upload", async () => {
    const result = await uploadReceiptAction(
      formWithFile(jpegBytes, "image/png"),
    );

    expect(result).toEqual({ ok: false, error: IMAGE_MIME_MISMATCH_SV });
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("reports unexpected OCR/storage failures as ocr.upload", async () => {
    const boom = new Error("storage timeout");
    mocks.extract.mockRejectedValue(boom);

    const result = await uploadReceiptAction(
      formWithFile(jpegBytes, "image/jpeg"),
    );

    expect(result).toEqual({
      ok: false,
      error: "Kunde inte spara bilden. Försök igen.",
    });
    expect(result.ok === false && result.error).not.toMatch(/storage timeout/);
    expect(mocks.extract).toHaveBeenCalledOnce();
    expect(mocks.report).toHaveBeenCalledWith("ocr.upload", boom);
  });

  it("maps a raw candidate fingerprint collision to Swedish copy and still reports it", async () => {
    const boom = new Error(
      'duplicate key value violates unique constraint "numa_candidates_user_fingerprint_unique"',
    );
    mocks.extract.mockRejectedValue(boom);

    const result = await uploadReceiptAction(
      formWithFile(jpegBytes, "image/jpeg"),
    );

    expect(result).toEqual({ ok: false, error: LIVE_MOVEMENT_ALREADY_SAVED_SV });
    expect(result.ok === false && result.error).not.toMatch(/duplicate key|unique constraint/);
    expect(mocks.report).toHaveBeenCalledWith("ocr.upload", boom);
  });
});
