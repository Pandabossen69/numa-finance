import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("smooth nav and saves", () => {
  it("does not drop the client router cache after money mutations", () => {
    const money = read("../../features/finance/actions.ts");
    const imports = read("../../features/imports/actions.ts");
    const gettingStarted = read("../../features/getting-started/actions.ts");
    const moneyFn = money.slice(
      money.indexOf("function revalidateMoneyPaths()"),
      money.indexOf("export async function updateTransactionAction"),
    );
    expect(moneyFn).not.toContain("revalidatePath(");
    expect(moneyFn).toContain('revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max")');
    expect(money).not.toContain("revalidatePath(");
    expect(moneyFn).not.toContain('revalidatePath("/", "layout")');
    expect(moneyFn).not.toContain('revalidatePath("/mer")');
    expect(imports).not.toContain('revalidatePath("/", "layout")');
    expect(gettingStarted).not.toContain('revalidatePath("/", "layout")');
  });

  it("prefetches force-dynamic tabs as full RSC payloads", () => {
    const prefetch = read("./prefetch-intent.ts");
    expect(prefetch).toContain('kind: "full"');
  });

  it("lets Hem, Rörelser, Lägg till and Saldo save without router.refresh", () => {
    const hem = read("../../components/home/HomeDashboard.tsx");
    const movements = read("../../components/movements/MovementsScreen.tsx");
    const add = read("../../components/add/QuickAddForms.tsx");
    const saldo = read("../../components/accounts/VerifyBalanceForm.tsx");
    const goHome = read("./instant.ts");
    expect(hem).not.toContain("router.refresh");
    expect(movements).not.toContain("router.refresh");
    expect(add).not.toContain("router.refresh");
    expect(saldo).not.toContain("router.refresh");
    expect(saldo).toContain("applyAccountBalance");
    expect(goHome).toContain('router.push("/idag")');
    expect(goHome).not.toContain("refreshQuiet");
    expect(goHome).not.toContain("router.refresh");
  });

  it("reads the cookie session in RSC instead of a second Auth getUser", () => {
    const auth = read("../supabase/auth-user.ts");
    expect(auth).toContain("auth.getSession()");
    expect(auth).toContain("2_000");
  });
});
