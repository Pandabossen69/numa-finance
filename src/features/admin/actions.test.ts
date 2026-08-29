import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("createUserAction profile write", () => {
  it("writes the typed name to auth metadata and the profile row", () => {
    expect(src).toContain("user_metadata: { display_name: displayName");
    expect(src).toContain(".update({ display_name: displayName })");
    expect(src).toContain("display_name: displayName");
    expect(src).not.toContain('|| "Användare"');
  });
});
