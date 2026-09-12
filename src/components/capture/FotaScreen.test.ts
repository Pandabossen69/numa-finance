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
const loading = readFileSync(
  new URL("../../app/(main)/fota/loading.tsx", import.meta.url),
  "utf8",
);
const outlet = readFileSync(
  new URL("../layout/LastViewOutlet.tsx", import.meta.url),
  "utf8",
);

describe("FotaScreen soft-nav", () => {
  it("prefers last-known boot, else calm titled Laddar… — never a blank dark shell", () => {
    expect(src).toContain("lastFotaBoot");
    expect(src).toContain("rememberFotaBoot");
    expect(src).toContain("lastHomeSnapshot");
    expect(src).toContain("FotaPending");
    expect(src).toContain("ReceiptCaptureFlow");
    expect(src).not.toContain("useLayoutEffect");
    expect(src).not.toContain("setReady");
    expect(src).not.toContain("FotaCaptureGate");
    expect(pending).toContain("Laddar…");
    expect(pending).toContain(">Fota<");
    expect(islands).toContain("FotaPending");
    expect(islands).toContain("loading: () => <FotaPending />");
    expect(loading).toContain("FotaScreen");
    expect(loading).toContain("data={null}");
    expect(outlet).toContain("destLoadingForTab");
  });
});
