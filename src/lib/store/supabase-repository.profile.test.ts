import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./supabase-repository.ts", import.meta.url), "utf8");

describe("ensureProfile display name", () => {
  it("seeds a placeholder from the map or auth metadata, never clobbers a stored name", () => {
    expect(src).toContain("resolveProfileDisplayName");
    expect(src).toContain("isPlaceholderDisplayName");
    expect(src).toContain("metadataDisplayName");
    expect(src).not.toContain("if (named && mapped.displayName !== named)");
    expect(src).not.toContain("knownDisplayNameForEmail");
  });
});
