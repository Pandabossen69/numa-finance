/**
 * Derives PWA / favicon / login-mark PNGs from the checked-in owl source.
 * Never synthesizes the old solid-circle placeholder.
 *
 * Source of truth: public/icons/source-icon.png (Hugo’s production mark).
 * Requires `sharp` to regenerate. Without it, existing brand files are left
 * untouched so `npm run icons` cannot wipe the identity.
 */
const fs = require("node:fs");
const path = require("node:path");

const BRAND_EMERALD = "#127a62";
const ICONS_DIR = path.join(__dirname, "..", "public", "icons");
const SOURCE_PATH = path.join(ICONS_DIR, "source-icon.png");
const FAVICON_PATH = path.join(__dirname, "..", "src", "app", "favicon.ico");
const APPLE_TOUCH_PATH = path.join(__dirname, "..", "public", "apple-touch-icon.png");

const REQUIRED_OUTPUTS = [
  path.join(ICONS_DIR, "icon-192.png"),
  path.join(ICONS_DIR, "icon-512.png"),
  path.join(ICONS_DIR, "icon-maskable-512.png"),
  path.join(ICONS_DIR, "mark.png"),
  FAVICON_PATH,
  APPLE_TOUCH_PATH,
];

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

function pngToIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const entries = [];
  for (const png of pngBuffers) {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    entries.push({
      width: width >= 256 ? 0 : width,
      height: height >= 256 ? 0 : height,
      size: png.length,
      offset,
    });
    offset += png.length;
  }

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  entries.forEach((entry, i) => {
    const o = 6 + i * 16;
    out[o] = entry.width;
    out[o + 1] = entry.height;
    out[o + 2] = 0;
    out[o + 3] = 0;
    out.writeUInt16LE(1, o + 4);
    out.writeUInt16LE(32, o + 6);
    out.writeUInt32LE(entry.size, o + 8);
    out.writeUInt32LE(entry.offset, o + 12);
  });
  let cursor = headerSize;
  for (const png of pngBuffers) {
    png.copy(out, cursor);
    cursor += png.length;
  }
  return out;
}

async function findOwlBox(sharp, sourceBuf) {
  const { data, info } = await sharp(sourceBuf).raw().toBuffer({
    resolveWithObject: true,
  });
  const { width: w, height: h, channels: ch } = info;
  const isBg = (r, g, b) =>
    r < 50 && g > 40 && g < 130 && b > 30 && b < 100 && g > r + 20;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      if (!isBg(data[i], data[i + 1], data[i + 2])) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    throw new Error("Could not find the owl in source-icon.png");
  }
  return { minX, minY, maxX, maxY, width: w, height: h };
}

function squareAround(box, padRatio) {
  const owlW = box.maxX - box.minX + 1;
  const owlH = box.maxY - box.minY + 1;
  const cx = (box.minX + box.maxX + 1) / 2;
  const cy = (box.minY + box.maxY + 1) / 2;
  const side = Math.ceil(Math.max(owlW, owlH) * (1 + padRatio));
  let left = Math.round(cx - side / 2);
  let top = Math.round(cy - side / 2);
  left = Math.max(0, Math.min(left, box.width - side));
  top = Math.max(0, Math.min(top, box.height - side));
  const width = Math.min(side, box.width - left);
  const height = Math.min(side, box.height - top);
  return { left, top, width, height };
}

async function extractSquare(sharp, sourceBuf, region) {
  return sharp(sourceBuf)
    .extract(region)
    .resize(1024, 1024, { fit: "cover", position: "center" })
    .png()
    .toBuffer();
}

async function paintOnEmerald(sharp, artwork, size, artworkRatio) {
  const artSize = Math.round(size * artworkRatio);
  const resized = await sharp(artwork)
    .resize(artSize, artSize, { fit: "cover", position: "center" })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BRAND_EMERALD,
    },
  })
    .composite([
      {
        input: resized,
        left: Math.round((size - artSize) / 2),
        top: Math.round((size - artSize) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function generate(sharp) {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Missing brand source: ${SOURCE_PATH}`);
  }
  const sourceBuf = fs.readFileSync(SOURCE_PATH);
  const box = await findOwlBox(sharp, sourceBuf);
  // Tight square for “any” icons — ears stay inside with a little emerald.
  const anyRegion = squareAround(box, 0.18);
  const artwork = await extractSquare(sharp, sourceBuf, anyRegion);

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  // Full-bleed home-screen icons: owl fills most of the tile.
  const icon512 = await paintOnEmerald(sharp, artwork, 512, 1);
  const icon192 = await sharp(icon512).resize(192, 192).png().toBuffer();
  // Maskable safe zone is the inner ~80% circle. Extra inset keeps ear tufts
  // inside Android adaptive / iOS squircle masks.
  const maskable512 = await paintOnEmerald(sharp, artwork, 512, 0.72);
  const mark = await paintOnEmerald(sharp, artwork, 128, 1);
  const apple = await sharp(icon512).resize(180, 180).png().toBuffer();
  const fav16 = await sharp(icon512).resize(16, 16).png().toBuffer();
  const fav32 = await sharp(icon512).resize(32, 32).png().toBuffer();
  const fav48 = await sharp(icon512).resize(48, 48).png().toBuffer();

  fs.writeFileSync(path.join(ICONS_DIR, "icon-512.png"), icon512);
  fs.writeFileSync(path.join(ICONS_DIR, "icon-192.png"), icon192);
  fs.writeFileSync(path.join(ICONS_DIR, "icon-maskable-512.png"), maskable512);
  fs.writeFileSync(path.join(ICONS_DIR, "mark.png"), mark);
  fs.writeFileSync(APPLE_TOUCH_PATH, apple);
  fs.writeFileSync(FAVICON_PATH, pngToIco([fav16, fav32, fav48]));
  console.log("Wrote NUMA owl icons from public/icons/source-icon.png");
}

function assertBrandFilesPresent() {
  const missing = REQUIRED_OUTPUTS.filter((file) => !fs.existsSync(file));
  if (missing.length) {
    throw new Error(
      `Brand icons missing and sharp is not installed:\n${missing.join("\n")}`,
    );
  }
  console.log(
    "sharp not installed — left checked-in NUMA owl icons in place (no placeholder).",
  );
}

async function main() {
  const sharp = loadSharp();
  if (!sharp) {
    assertBrandFilesPresent();
    return;
  }
  await generate(sharp);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
