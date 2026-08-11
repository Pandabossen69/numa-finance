/**
 * Downscale phone photos before upload so OCR feels fast on mobile.
 * Keeps aspect ratio; skips tiny images; falls back to original on failure.
 */
export async function compressImageForUpload(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<File> {
  const maxEdge = options?.maxEdge ?? 1800;
  const quality = options?.quality ?? 0.72;

  if (!file.type.startsWith("image/") || file.type.includes("heic")) {
    return file;
  }
  // Already small enough — skip canvas work.
  if (file.size < 450_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 0.98 && file.size < 1_200_000) {
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
