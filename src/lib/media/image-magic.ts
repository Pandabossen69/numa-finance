const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (JPEG.every((b, i) => bytes[i] === b)) return "image/jpeg";
  if (PNG.every((b, i) => bytes[i] === b)) return "image/png";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  const box = String.fromCharCode(...bytes.slice(4, 8));
  const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
  if (box === "ftyp" && (brand.startsWith("heic") || brand.startsWith("heif") || brand.startsWith("mif1"))) {
    return brand.startsWith("heif") ? "image/heif" : "image/heic";
  }
  return null;
}

export function assertAllowedImageBytes(bytes: Uint8Array, claimedMime?: string): string {
  const sniffed = sniffImageMime(bytes);
  if (!sniffed || !ALLOWED_IMAGE_MIME.has(sniffed)) {
    throw new Error("Filen är inte en giltig bild (JPEG, PNG, WebP eller HEIC)");
  }
  if (
    claimedMime &&
    ALLOWED_IMAGE_MIME.has(claimedMime) &&
    claimedMime !== sniffed &&
    !(claimedMime === "image/heif" && sniffed === "image/heic") &&
    !(claimedMime === "image/heic" && sniffed === "image/heif")
  ) {
    throw new Error("Filtypen stämmer inte med innehållet");
  }
  return sniffed;
}
