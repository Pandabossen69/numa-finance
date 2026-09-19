import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");
const client = readFileSync(
  new URL("../../../components/accounts/AccountsRouteClient.tsx", import.meta.url),
  "utf8",
);

describe("/konton instant shell", () => {
  it("paints last-known Saldo client-first — no RSC ledger await", () => {
    expect(page).toContain("AccountsRouteClient");
    expect(page).not.toContain("loadAccountsSnapshot");
    expect(page).not.toContain("Suspense");
    expect(page).not.toContain("KontonBody");
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("AccountsDashboard");
    expect(loading).not.toContain("AccountsViewLoading");
    expect(client).toContain("getAccountsSnapshotAction");
    expect(client).toContain("lastAccountsSnapshot");
    expect(client).toContain("if (lastAccountsSnapshot()) return;");
    expect(client).toContain("if (!lastAccountsSnapshot()) setError");
  });
});
