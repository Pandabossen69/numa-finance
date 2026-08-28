import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/konton instant shell", () => {
  it("streams last-known Saldo while accounts load", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("AccountsDashboard");
    expect(page).toContain("data={null}");
    expect(loading).toContain("AccountsViewLoading");
  });
});
