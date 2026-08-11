/**
 * Light downscale before upload. Bank-SMS screenshots stay sharp —
 * OCR needs crisp Bt / available-balance digits.
 */
export async function compressImageForUpload(
  file: File,
  options?: {
    maxEdge?: number;
    quality?: number;
    /** Preserve text for Bangkok Bank SMS screenshots. */
    preserveText?: boolean;
  },
): Promise<File> {
  const preserveText = options?.preserveText === true;
  const maxEdge = options?.maxEdge ?? (preserveText ? 2400 : 1800);
  const quality = options?.quality ?? (preserveText ? 0.92 : 0.72);

  if (!file.type.startsWith("image/") || file.type.includes("heic")) {
    return file;
  }
  // SMS screenshots under ~2.5MB: never recompress (sharpest OCR).
  if (preserveText && file.size < 2_500_000) return file;
  if (!preserveText && file.size < 450_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 0.98 && file.size < (preserveText ? 3_000_000 : 1_200_000)) {
      bitmap.close();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "bank-sms";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
