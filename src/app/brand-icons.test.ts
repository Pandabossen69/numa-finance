import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function pngSize(buf: Buffer) {
  expect(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
    true,
  );
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("NUMA owl brand icons", () => {
  it("checks in the production owl as the source of truth", () => {
    const source = readFileSync(join(root, "public/icons/source-icon.png"));
    const { width, height } = pngSize(source);
    expect(width).toBe(1280);
    expect(height).toBe(720);
    expect(source.length).toBeGreaterThan(80_000);
  });

  it("ships real 192 / 512 / maskable / mark / apple-touch PNGs", () => {
    const files = [
      ["public/icons/icon-192.png", 192],
      ["public/icons/icon-512.png", 512],
      ["public/icons/icon-maskable-512.png", 512],
      ["public/icons/mark.png", 128],
      ["public/apple-touch-icon.png", 180],
    ] as const;

    for (const [rel, size] of files) {
      const buf = readFileSync(join(root, rel));
      expect(pngSize(buf)).toEqual({ width: size, height: size });
      // Old placeholder circle was ~1–4 KB of flat color.
      expect(buf.length).toBeGreaterThan(8_000);
    }

    expect(existsSync(join(root, "src/app/favicon.ico"))).toBe(true);
    expect(readFileSync(join(root, "src/app/favicon.ico")).length).toBeGreaterThan(1_000);
  });

  it("cannot regenerate the old solid-circle placeholder", () => {
    const script = readFileSync(join(root, "scripts/generate-icons.cjs"), "utf8");
    expect(script).toContain("source-icon.png");
    expect(script).toContain("#127a62");
    expect(script).not.toContain("inCircle");
    expect(script).not.toContain("simple monochrome mark");
    expect(script).not.toMatch(/createPng\(/);
  });
});
