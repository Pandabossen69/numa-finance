import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/mer loading shell", () => {
  it("streams a Mer-shaped shell so last-known paints instead of empty mint", () => {
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("MerScreen");
    expect(loading).not.toContain("MerViewLoading");
    expect(loading).not.toContain('from "@/components/layout/ViewLoading"');
  });
});
