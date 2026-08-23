import { describe, expect, it } from "vitest";
import { SV } from "./labels-sv";

describe("Swedish money labels", () => {
  it("never calls the plan leftover pile Saldo or Allt i NUMA", () => {
    expect(SV.motPlanen).toBe("Mot planen");
    expect(SV.alltINuma).toBe("Plan + sparande");
    expect(SV.paKontot).toBe("På kontot");
    expect(SV.saldo).toBe("Saldo");
    expect(SV.motPlanen).not.toBe(SV.saldo);
    expect(SV.alltINuma.toLowerCase()).not.toMatch(/allt i numa/);
    expect(SV.kvarIManadenPlan).toMatch(/plan/i);
  });

  it("keeps Analys scope labels short and Swedish", () => {
    expect(SV.perioden).toBe("Perioden");
    expect(SV.manad).toBe("Månad");
    expect(SV.saRaknarNuma).toBe("Så räknar NUMA");
  });

  it("keeps Mot planen as the plan leftover label", () => {
    expect(SV.motPlanen).toBe("Mot planen");
    expect(SV.minusMotPlanen).toBe("Minus mot planen");
    expect(SV.overDagsbudget).toBe("Över dagsbudgeten");
  });

  it("points Flytta/Kontant empty states to Mer → Saldo", () => {
    expect(SV.merPathSaldo).toBe("Mer → Saldo");
    expect(SV.merPathSaldo).not.toMatch(/Mina saldon/i);
    expect(SV.saldo).toBe("Saldo");
  });
});
