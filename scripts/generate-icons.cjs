/**
 * Derives PWA / favicon / login-mark PNGs from the checked-in Steel + Orange
 * NUMA source icon. Never synthesizes the old solid-circle placeholder.
 *
 * Source of truth: public/icons/source-icon.png (Hugo's production mark).
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ICON_BACKGROUND = "#050607";
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

async function squareIcon(sourceBuf, size, insetRatio = 1) {
  const innerSize = Math.round(size * insetRatio);
  const artwork = await sharp(sourceBuf)
    .flatten({ background: ICON_BACKGROUND })
    .resize(innerSize, innerSize, { fit: "cover", position: "center" })
    .png()
    .toBuffer();

  if (innerSize === size) {
    return artwork;
  }

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: ICON_BACKGROUND,
    },
  })
    .composite([
      {
        input: artwork,
        left: Math.round((size - innerSize) / 2),
        top: Math.round((size - innerSize) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function symbolMark(sourceBuf, size, options = {}) {
  const meta = await sharp(sourceBuf).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const left = Math.round(width * 0.14);
  const top = Math.round(height * 0.17);
  const cropWidth = Math.round(width * 0.72);
  const cropHeight = Math.round(height * 0.38);

  const builder = sharp(sourceBuf)
    .flatten({ background: ICON_BACKGROUND })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(size, size, { fit: "contain", background: ICON_BACKGROUND });

  const mark = await (options.rgba ? builder.ensureAlpha() : builder).png().toBuffer();

  return mark;
}

async function assertSourceIsProductionIcon(sourceBuf) {
  const meta = await sharp(sourceBuf).metadata();
  if (meta.width !== meta.height || (meta.width ?? 0) < 1024) {
    throw new Error("source-icon.png must be a square production icon at least 1024px wide");
  }
  if (sourceBuf.length < 100_000) {
    throw new Error("source-icon.png is unexpectedly small for the Steel + Orange artwork");
  }
}

async function generate() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Missing brand source: ${SOURCE_PATH}`);
  }

  const sourceBuf = fs.readFileSync(SOURCE_PATH);
  await assertSourceIsProductionIcon(sourceBuf);
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const icon512 = await squareIcon(sourceBuf, 512);
  const icon192 = await squareIcon(sourceBuf, 192);
  const maskable512 = await squareIcon(sourceBuf, 512, 0.8);
  const mark = await symbolMark(sourceBuf, 128);
  const apple = await squareIcon(sourceBuf, 180);
  const fav16 = await symbolMark(sourceBuf, 16, { rgba: true });
  const fav32 = await symbolMark(sourceBuf, 32, { rgba: true });
  const fav48 = await symbolMark(sourceBuf, 48, { rgba: true });

  fs.writeFileSync(path.join(ICONS_DIR, "icon-512.png"), icon512);
  fs.writeFileSync(path.join(ICONS_DIR, "icon-192.png"), icon192);
  fs.writeFileSync(path.join(ICONS_DIR, "icon-maskable-512.png"), maskable512);
  fs.writeFileSync(path.join(ICONS_DIR, "mark.png"), mark);
  fs.writeFileSync(APPLE_TOUCH_PATH, apple);
  fs.writeFileSync(FAVICON_PATH, pngToIco([fav16, fav32, fav48]));

  const missing = REQUIRED_OUTPUTS.filter((file) => !fs.existsSync(file));
  if (missing.length) {
    throw new Error(`Brand icons missing:\n${missing.join("\n")}`);
  }

  console.log("Wrote Steel + Orange NUMA icons from public/icons/source-icon.png");
}

generate().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
