/**
 * Writes minimal solid-color PNG icons for PWA installability.
 * No external brand lock-in — simple monochrome mark.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(size, rgba) {
  const [r, g, b, a] = rgba;
  const row = Buffer.alloc(1 + size * 4);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.from(row);
    line[0] = 0;
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2;
      const cy = y - size / 2;
      const inCircle = cx * cx + cy * cy <= (size * 0.36) ** 2;
      const i = 1 + x * 4;
      if (inCircle) {
        line[i] = 255;
        line[i + 1] = 255;
        line[i + 2] = 255;
        line[i + 3] = 255;
      } else {
        line[i] = r;
        line[i + 1] = g;
        line[i + 2] = b;
        line[i + 3] = a;
      }
    }
    rows.push(line);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const color = [31, 111, 91, 255];
fs.writeFileSync(path.join(outDir, "icon-192.png"), createPng(192, color));
fs.writeFileSync(path.join(outDir, "icon-512.png"), createPng(512, color));
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), createPng(512, color));
console.log("Wrote PWA icons to public/icons");
