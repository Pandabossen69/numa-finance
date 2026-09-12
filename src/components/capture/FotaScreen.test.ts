import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./FotaScreen.tsx", import.meta.url), "utf8");
const pending = readFileSync(
  new URL("./FotaViewLoading.tsx", import.meta.url),
  "utf8",
);
const islands = readFileSync(
  new URL("../../lib/route-islands.tsx", import.meta.url),
  "utf8",
);

describe("FotaScreen soft-nav", () => {
  it("prefers last-known boot, else calm titled Laddar… — never a blank dark shell", () => {
    expect(src).toContain("lastFotaBoot");
    expect(src).toContain("rememberFotaBoot");
    expect(src).toContain("lastHomeSnapshot");
    expect(src).toContain("FotaPending");
    expect(src).toContain("FotaCaptureGate");
    expect(src).toContain("useLayoutEffect");
    expect(src).toContain("ReceiptCaptureFlow");
    expect(pending).toContain("Laddar…");
    expect(pending).toContain(">Fota<");
    expect(islands).toContain("FotaPending");
    expect(islands).toContain("loading: () => <FotaPending />");
  });
});
