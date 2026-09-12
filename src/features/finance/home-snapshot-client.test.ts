import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

describe("home-snapshot-client", () => {
  it("coalesces concurrent getHomeSnapshotAction calls", async () => {
    vi.resetModules();
    const action = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true as const, data: { userId: "u1" } };
    });
    vi.doMock("@/features/finance/home-snapshot", () => ({
      getHomeSnapshotAction: action,
    }));
    const { fetchHomeSnapshot, resetHomeSnapshotClientForTests } = await import(
      "./home-snapshot-client"
    );
    resetHomeSnapshotClientForTests();
    const [a, b] = await Promise.all([fetchHomeSnapshot(), fetchHomeSnapshot()]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.ok).toBe(true);
  });
});

describe("login → Hem boot priority (source contracts)", () => {
  it("starts Hem fetch before quiet menu warm on login success", () => {
    const auth = readFileSync(new URL("../../components/auth/AuthExperience.tsx", import.meta.url), "utf8");
    const kick = auth.slice(
      auth.indexOf("function kickPostLoginWarm"),
      auth.indexOf("export function AuthExperience"),
    );
    expect(kick).toContain("fetchHomeSnapshot");
    expect(kick).toContain("scheduleQuietMenuWarm");
    expect(kick).toContain("urgent: true");
    expect(kick.indexOf("scheduleQuietMenuWarm")).toBeLessThan(
      kick.indexOf("rememberHomeSnapshot"),
    );
    expect(kick).not.toMatch(
      /scheduleQuietMenuWarm\(\{\s*restart:\s*true\s*\}\)/,
    );
  });

  it("Hem joins coalesced fetch and skips duplicate when already confirmed", () => {
    const hem = readFileSync(
      new URL("../../components/home/HemRouteClient.tsx", import.meta.url),
      "utf8",
    );
    expect(hem).toContain("fetchHomeSnapshot");
    expect(hem).toContain("lastSessionHomeSnapshot()");
    expect(hem).toContain("scheduleQuietMenuWarm({ urgent: true })");
    expect(hem).not.toMatch(/getHomeSnapshotAction\(\)/);
  });

  it("cold menu tabs wait on afterHemBoot so keep-alive does not herd", () => {
    for (const rel of [
      "../../components/plan/PlanRouteClient.tsx",
      "../../components/analys/AnalysRouteClient.tsx",
      "../../components/movements/MovementsRouteClient.tsx",
      "../../components/mer/MerRouteClient.tsx",
    ] as const) {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8");
      expect(src, rel).toContain("afterHemBoot");
    }
  });
});
