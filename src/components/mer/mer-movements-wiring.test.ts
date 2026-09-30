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

describe("Mer menu wiring", () => {
  it("resets only the Rörelser row, before markIntent and before panel paint", () => {
    expect(mer).toContain("resetMovementsViewForMenuEntry");
    expect(mer).toContain("flushSync");
    expect(mer).toContain('window.addEventListener("pointerdown", onActivate, true)');
    expect(mer).toContain('window.addEventListener("click", onActivate, true)');
    expect(mer).toContain("resetsMovements: true");
    expect(mer).toContain("item.resetsMovements ? openRorelserFromMer");
    expect(mer).not.toContain('item.href === "/transaktioner"');
    expect(mer.match(/beforeIntent=/g)).toHaveLength(1);

    const link = hub.slice(
      hub.indexOf("export function MerListLink"),
      hub.indexOf("export function MerListRow"),
    );
    const down = link.indexOf("onPointerDown");
    const click = link.indexOf("onClick");
    expect(link.indexOf("beforeIntent?.()", down)).toBeGreaterThan(down);
    expect(link.indexOf("beforeIntent?.()", down)).toBeLessThan(
      link.indexOf("markIntent(href)", down),
    );
    expect(link.indexOf("beforeIntent?.()", click)).toBeGreaterThan(click);
    expect(link.indexOf("beforeIntent?.()", click)).toBeLessThan(
      link.indexOf("markIntent(href)", click),
    );
    expect(link).toContain(
      'data-mer-movements={beforeIntent ? "rorelser" : undefined}',
    );
    expect(mer).toContain('getAttribute("data-mer-movements") !== "rorelser"');
  });

  it("leaves the Analys category drill on rememberMovementsView", () => {
    expect(analys).toContain("movementsViewForCategoryDrill(");
    expect(analys).toContain("rememberMovementsView(");
    expect(analys).not.toContain("resetMovementsViewForMenuEntry");
  });

  it("lets a parked Rörelser panel adopt the menu reset before paint", () => {
    expect(movements).toContain("subscribeMovementsView");
    expect(movements).toContain("useLayoutEffect");
    expect(movements).toContain(
      "setFilter((prev) => (prev === next.filter ? prev : next.filter))",
    );
    expect(movements).toContain(
      "setPeriod((prev) => (prev === next.period ? prev : next.period))",
    );
    expect(movements).toContain("next.category");
  });
});
