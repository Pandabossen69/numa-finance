import {
  CLIENT_UPLOAD_BUDGET_BYTES,
  IMAGE_TOO_BIG_SV,
  IMAGE_UNREADABLE_SV,
  PHOTO_MAX_EDGE,
  TEXT_MAX_EDGE,
  UPLOAD_JPEG_QUALITY,
  downscaleFactor,
} from "@/lib/media/upload-limits";

export class ImagePrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepareError";
  }
}

/**
 * Scale and re-encode before a Server Action upload.
 * Longest side stays at or below ~2000–2400 px. Never upscales.
 * The result stays under the Vercel request cap so a 1–10 MB screenshot
 * does not hit the 1 MB action default or the 4.5 MB platform limit.
 */
export async function compressImageForUpload(
  file: File,
  options?: {
    maxEdge?: number;
    quality?: number;
    /** Bank-SMS / bankapp keep a slightly longer edge than a receipt. */
    preserveText?: boolean;
  },
): Promise<File> {
  const preserveText = options?.preserveText === true;
  const maxEdge = options?.maxEdge ?? (preserveText ? TEXT_MAX_EDGE : PHOTO_MAX_EDGE);
  const quality = options?.quality ?? UPLOAD_JPEG_QUALITY;

  if (isHeic(file.type)) {
    throw new ImagePrepareError(IMAGE_UNREADABLE_SV);
  }

  if (!file.type.startsWith("image/")) {
    if (file.size > CLIENT_UPLOAD_BUDGET_BYTES) {
      throw new ImagePrepareError(IMAGE_TOO_BIG_SV);
    }
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImagePrepareError(IMAGE_UNREADABLE_SV);
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = downscaleFactor(longest, maxEdge);
    // Already inside the historical 1 MB action default and the OCR edge.
    if (scale === 1 && file.size > 0 && file.size <= 1_000_000) return file;

    const encoded = await encodeUntilBudget(bitmap, maxEdge, quality);
    if (
      encoded &&
      encoded.size <= CLIENT_UPLOAD_BUDGET_BYTES &&
      (scale < 1 || encoded.size < file.size || file.size > CLIENT_UPLOAD_BUDGET_BYTES)
    ) {
      return jpegFile(file, encoded);
    }
    if (file.size <= CLIENT_UPLOAD_BUDGET_BYTES && scale === 1) return file;
    if (encoded && encoded.size <= CLIENT_UPLOAD_BUDGET_BYTES) {
      return jpegFile(file, encoded);
    }
    throw new ImagePrepareError(IMAGE_TOO_BIG_SV);
  } finally {
    bitmap.close();
  }
}

function isHeic(type: string): boolean {
  return type.includes("heic") || type.includes("heif");
}

async function encodeUntilBudget(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  const qualities = [quality, 0.75, 0.65, 0.55];
  let edge = maxEdge;
  let best: Blob | null = null;
  for (let step = 0; step < 4; step += 1) {
    for (const q of qualities) {
      const blob = await encodeJpeg(bitmap, edge, q);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= CLIENT_UPLOAD_BUDGET_BYTES) return blob;
    }
    edge = Math.max(1280, Math.round(edge * 0.85));
  }
  return best;
}

function encodeJpeg(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  const scale = downscaleFactor(Math.max(bitmap.width, bitmap.height), maxEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function jpegFile(file: File, blob: Blob): File {
  const base = file.name.replace(/\.[^.]+$/, "") || "bild";
  return new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
