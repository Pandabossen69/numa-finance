import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const editor = readFileSync(
  new URL("../../components/plan/PlanEditor.tsx", import.meta.url),
  "utf8",
);

/**
 * Phase-1 save stability: creating a plan row must not ship an RSC Flight
 * refresh of /plan in the action response. That refresh is what froze the UI
 * after a successful Supabase write.
 */
describe("plan create/save does not freeze the current route", () => {
  it("never calls revalidatePath from plan actions", () => {
    expect(actions).not.toMatch(/revalidatePath\s*\(/);
    expect(actions).toContain("revalidateTag(NUMA_MENU_SNAPSHOT_TAG");
  });

  it("keeps create income/fixed/extra on the tag-only cache path", () => {
    const income = actions.slice(
      actions.indexOf("export async function createPlanIncomeAction"),
      actions.indexOf("export async function createPlanExtraAction"),
    );
    const extra = actions.slice(
      actions.indexOf("export async function createPlanExtraAction"),
      actions.indexOf("export async function setMonthSavingsAction"),
    );
    const item = actions.slice(
      actions.indexOf("export async function createPlanItemAction"),
      actions.indexOf("export async function createPlanIncomeAction"),
    );
    for (const slice of [income, extra, item]) {
      expect(slice).toContain("revalidatePlanPaths()");
      expect(slice).not.toMatch(/revalidatePath\s*\(/);
    }
  });

  it("adopts server props without setState during render", () => {
    expect(editor).toContain("const viewItems = busy");
    expect(editor).toContain("adoptServerPlanItems(localItems, items)");
    expect(editor).not.toContain("if (!busy && incomingStamp !== itemsStamp)");
    expect(editor).not.toContain("setItemsStamp");
  });

  it("blocks a second write before React re-renders busy", () => {
    expect(editor).toContain("writeLockRef");
    expect(editor).toContain("if (writeLockRef.current) return false");
  });
});
