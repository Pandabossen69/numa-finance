import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mer = readFileSync(new URL("./MerScreen.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("./MerHub.tsx", import.meta.url), "utf8");
const analys = readFileSync(
  new URL("../analys/AnalysDashboard.tsx", import.meta.url),
  "utf8",
);
const movements = readFileSync(
  new URL("../movements/MovementsScreen.tsx", import.meta.url),
  "utf8",
);
const nav = readFileSync(
  new URL("../layout/NavIntent.tsx", import.meta.url),
  "utf8",
);

describe("Mer menu wiring", () => {
  it("keeps Mer → Rörelser a plain link with no reset", () => {
    expect(mer).not.toContain("resetMovementsViewForMenuEntry");
    expect(mer).not.toContain("resetsMovements");
    expect(mer).not.toContain("beforeIntent");
    expect(mer).not.toContain("data-mer-movements");
    expect(mer).not.toContain('window.addEventListener("pointerdown"');
    expect(mer).toContain('href: "/transaktioner"');
    expect(hub).not.toContain("beforeIntent");
    expect(hub).not.toContain("data-mer-movements");
    expect(hub).toContain("markIntent(href)");
  });

  it("puts the Analys category drill in the URL, not the remembered view", () => {
    expect(analys).toContain("categoryDrillHref(");
    expect(analys).not.toContain("rememberMovementsView(");
    expect(analys).not.toContain("movementsViewForCategoryDrill(");
    expect(analys).not.toContain('window.addEventListener("pointerdown"');
    expect(analys).toContain("data-analys-category={category.name}");
  });

  it("lets a parked Rörelser panel read the drill store without saving it", () => {
    expect(movements).toContain("subscribeMovementsDrill");
    expect(movements).toContain("lastMovementsDrill");
    expect(movements).toContain("rememberMovementsView({");
    expect(movements).not.toContain("setSource");
    expect(nav).toContain("rememberMovementsDrillFromHref");
    expect(nav).toContain("commitSpaHref");
    const reveal = nav.slice(nav.lastIndexOf("spaOwnedRef.current = true"));
    expect(reveal.indexOf("commitSpaHref(href)")).toBeGreaterThan(-1);
    expect(reveal.indexOf("commitSpaHref(href)")).toBeLessThan(
      reveal.indexOf("paintSpaPanelsNow(dest)"),
    );
  });
});
