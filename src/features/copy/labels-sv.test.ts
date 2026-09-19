import { describe, expect, it } from "vitest";
import { planDoneLabel, planPartialLabel, SV } from "./labels-sv";

describe("Swedish money labels", () => {
  it("never calls the plan leftover pile Saldo or Allt i NUMA", () => {
    expect(SV.motPlanen).toBe("Mot planen");
    expect(SV.alltINuma).toBe("Plan + sparande");
    expect(SV.paKontot).toBe("På kontona");
    expect(SV.saldo).toBe("På kontona");
    expect(SV.motPlanen).not.toBe(SV.saldo);
    expect(SV.alltINuma.toLowerCase()).not.toMatch(/allt i numa/);
    expect(SV.kvarIManadenPlan).toMatch(/plan/i);
  });

  it("keeps Analys scope labels short and Swedish", () => {
    expect(SV.perioden).toBe("Perioden");
    expect(SV.manad).toBe("Månad");
    expect(SV.saRaknarNuma).toBe("Så räknas analysen");
    expect(SV.saRaknasAnalysenLead).toMatch(/inte dagsbudgeten på Hem/i);
    expect(SV.analysHint).toBe("Se vart pengarna gick — och hur perioden går.");
    expect(SV.vartGickPengarna).toBe("Vart gick pengarna?");
    expect(SV.hurGarDet).toBe("Hur går det?");
    expect(SV.analysCategoryHint).toMatch(/samma belopp som spenderat/i);
    expect(SV.analysEmptySpendPeriod).toMatch(/när du handlar/i);
    expect(SV.analysPlanPointer).toMatch(/plan/i);
  });

  it("keeps Mot planen as the Analys leftover label, not the Plan/Hem cash hero", () => {
    expect(SV.motPlanen).toBe("Mot planen");
    expect(SV.minusMotPlanen).toBe("Minus mot planen");
    expect(SV.overskottMotPlanenHint).toBe(
      "Planerat kvar minus spenderat — inte pengar på kontona.",
    );
    expect(SV.overskottMotPlanenHint).toMatch(/inte pengar på kontona/i);
    expect(SV.over).toBe("Över");
    expect(SV.kommerIn).toBe("Kommer in");
    expect(SV.kvarAttBetala).toBe("Kvar att betala");
    expect(SV.over).not.toBe(SV.motPlanen);
    expect(SV.overDagsbudget).toBe("Över dagsbudgeten");
    expect(SV.tillNastaInkomst).toBe("Till nästa inkomst");
    expect(SV.sparandeHintHem).toMatch(/över/i);
    expect(SV.sparandeHintHem).not.toMatch(/inte Över/i);
    expect(SV.sparandeTotalt).toBe("Sparat från tidigare");
    expect(SV.sparandeTotalt).not.toMatch(/numa/i);
    expect(SV.sattAvFranOver).toBe("Sätt av från Över");
    expect(SV.sparaDennaManad).toBe("Spara denna månad");
    expect(SV.sparaI("september")).toBe("Spara i september");
    expect(SV.sparaI("oktober")).toBe("Spara i oktober");
    expect(SV.sparaI("september")).not.toMatch(/planerat/i);
  });

  it("points Flytta/Kontant empty states to Mer → Konton", () => {
    expect(SV.merPathSaldo).toBe("Mer → Konton");
    expect(SV.merPathSaldo).not.toMatch(/Mina saldon/i);
    expect(SV.saldo).toBe("På kontona");
  });

  it("keeps Hem low-Kvar next-action labels short and Swedish", () => {
    expect(SV.laggUtgift).toBe("Lägg utgift");
    expect(SV.oppnaPlan).toBe("Öppna Plan");
    expect(SV.laggUtgiftHintLowKvar).toBe("Logga det du handlar.");
    expect(SV.oppnaPlanHintLowKvar).toBe("Se vad som måste ut.");
    expect(SV.nastaSteg).toBe("Nästa steg");
    expect(SV.laggUtgift).not.toBe(SV.laggtillUtgift);
  });

  it("teaches Hem, Plan and Fota in short Swedish", () => {
    expect(SV.fotaHint).toBe("Fånga saldo eller kvitto så du slipper skriva.");
    expect(SV.planHint).toBe("Vad som kommer in och vad som måste ut.");
    expect(SV.fotaHint).not.toMatch(/[A-Za-z]*welcome/i);
    expect(SV.planHint).not.toMatch(/journey/i);
    expect(SV.fotaHint).not.toMatch(/välkommen/i);
    expect(SV.planHint).not.toMatch(/välkommen/i);
  });

  it("marks plan incomes Mottagen and expenses Betald", () => {
    expect(SV.betald).toBe("Betald");
    expect(SV.mottagen).toBe("Mottagen");
    expect(SV.delvisBetald).toBe("Delvis betald");
    expect(SV.delvisMottagen).toBe("Delvis mottagen");
    expect(planDoneLabel("expense")).toBe("Betald");
    expect(planDoneLabel("income")).toBe("Mottagen");
    expect(planPartialLabel("expense")).toBe("Delvis betald");
    expect(planPartialLabel("income")).toBe("Delvis mottagen");
  });
});
