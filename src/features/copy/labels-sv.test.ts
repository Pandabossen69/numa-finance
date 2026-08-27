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

  it("keeps Mot planen as the Analys leftover label, not the Plan/Hem cash hero", () => {
    expect(SV.motPlanen).toBe("Mot planen");
    expect(SV.minusMotPlanen).toBe("Minus mot planen");
    expect(SV.over).toBe("Över");
    expect(SV.kommerIn).toBe("Kommer in");
    expect(SV.kvarAttBetala).toBe("Kvar att betala");
    expect(SV.over).not.toBe(SV.motPlanen);
    expect(SV.overDagsbudget).toBe("Över dagsbudgeten");
  });

  it("points Flytta/Kontant empty states to Mer → Saldo", () => {
    expect(SV.merPathSaldo).toBe("Mer → Saldo");
    expect(SV.merPathSaldo).not.toMatch(/Mina saldon/i);
    expect(SV.saldo).toBe("Saldo");
  });

  it("teaches Hem, Plan and Fota in short Swedish", () => {
    expect(SV.fotaHint).toBe("Fånga saldo eller kvitto så du slipper skriva.");
    expect(SV.planHint).toBe("Vad som kommer in och vad som måste ut.");
    expect(SV.fotaHint).not.toMatch(/[A-Za-z]*welcome/i);
    expect(SV.planHint).not.toMatch(/journey/i);
  });
});
