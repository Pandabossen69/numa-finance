import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentsDir = new URL(".", import.meta.url).pathname;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * One token system: colour lives in globals.css :root, never inline in a
 * component. /laga is exempt elsewhere — it ships inline styles on purpose
 * so the repair screen still renders when the stylesheet fails to load.
 */
describe("component colour tokens", () => {
  const files = tsxFiles(componentsDir);

  it("finds the component tree", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("has no raw hex or rgb() colour in any component", () => {
    const offenders = files
      .map((file) => {
        const src = readFileSync(file, "utf8");
        const hits = [
          ...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
          ...src.matchAll(/\brgba?\(/g),
        ].map((match) => match[0]);
        return hits.length > 0
          ? `${path.relative(componentsDir, file)}: ${hits.join(", ")}`
          : null;
      })
      .filter(Boolean);
    expect(offenders).toEqual([]);
  });

  it("uses no named Tailwind palette colour", () => {
    const named =
      /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/g;
    const offenders = files
      .map((file) => {
        const hits = [...readFileSync(file, "utf8").matchAll(named)].map(
          (match) => match[0],
        );
        return hits.length > 0
          ? `${path.relative(componentsDir, file)}: ${hits.join(", ")}`
          : null;
      })
      .filter(Boolean);
    expect(offenders).toEqual([]);
  });
});
