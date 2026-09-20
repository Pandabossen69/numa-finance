import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AccountsRouteClient.tsx", import.meta.url), "utf8");

describe("AccountsRouteClient", () => {
  it("paints last-known and skips cold fetch when quiet-warm already filled", () => {
    expect(src).toContain("paintableAccountsSnapshot");
    expect(src).toContain("subscribeAccountsSnapshot");
    expect(src).toContain("getAccountsSnapshotAction");
    expect(src).toContain("if (paintableAccountsSnapshot()) return;");
    expect(src).toContain("if (!isAccountsDirty()) rememberAccountsSnapshot");
    expect(src).toContain("if (!paintableAccountsSnapshot()) setError");
    expect(src).toContain("<AccountsDashboard data={stored} error={error} />");
  });
});
