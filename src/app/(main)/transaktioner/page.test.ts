import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/transaktioner instant shell", () => {
  it("paints last-known Rörelser client-first under keep-alive", () => {
    expect(page).toContain("MovementsRouteClient");
    expect(page).not.toContain("Suspense");
    expect(page).not.toContain("loadMovementsSnapshot");
    expect(page).not.toContain("route-islands");
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("MovementsScreen");
    expect(loading).toContain("data={null}");
    expect(loading).not.toContain("MovementsViewLoading");
  });
});
