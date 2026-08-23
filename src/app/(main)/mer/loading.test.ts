import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/mer loading shell", () => {
  it("streams ViewLoading so LastViewOutlet can hold the previous tab", () => {
    expect(loading).toContain("ViewLoading");
  });
});
