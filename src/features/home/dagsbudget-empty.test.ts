import { describe, expect, it } from "vitest";
import {
  DAGSBUDGET_BILLS_EXCEED_SALDO_SV,
  PERIOD_ENDED_BODY_SV,
  PERIOD_ENDED_CTA_SV,
  PERIOD_ENDED_TITLE_SV,
  periodEndedOnSv,
  unpaidBillsExceedSaldo,
} from "./dagsbudget-empty";

describe("unpaidBillsExceedSaldo", () => {
  it("explains an empty dagsbudget when bills are larger than saldo", () => {
    expect(
      unpaidBillsExceedSaldo({
        hasSaldo: true,
        isEmpty: false,
        showDayEnvelope: false,
        unpaidMinor: 12_000_00,
        balanceMinor: 3_000_00,
      }),
    ).toBe(true);
    expect(DAGSBUDGET_BILLS_EXCEED_SALDO_SV).toContain(
      "Obetalda räkningar före lönen är större än saldot",
    );
    expect(DAGSBUDGET_BILLS_EXCEED_SALDO_SV).toContain("Betala senare");
  });

  it("stays quiet when a dagsbudget is already showing or there is no saldo", () => {
    expect(
      unpaidBillsExceedSaldo({
        hasSaldo: true,
        isEmpty: false,
        showDayEnvelope: true,
        unpaidMinor: 12_000_00,
        balanceMinor: 3_000_00,
      }),
    ).toBe(false);
    expect(
      unpaidBillsExceedSaldo({
        hasSaldo: false,
        isEmpty: true,
        showDayEnvelope: false,
        unpaidMinor: 1,
        balanceMinor: null,
      }),
    ).toBe(false);
  });
});

describe("period ended copy", () => {
  it("names the closed period from the cycle date and keeps the calm Hem lines", () => {
    expect(PERIOD_ENDED_TITLE_SV).toBe("Perioden är slut");
    expect(PERIOD_ENDED_BODY_SV).toBe(
      "Lägg in nästa inkomst i Plan så räknar vi ut din dagsbudget.",
    );
    expect(PERIOD_ENDED_CTA_SV).toBe("Lägg in inkomst");
    expect(periodEndedOnSv("25 okt.")).toBe("Perioden avslutad 25 okt");
    expect(periodEndedOnSv("25 okt")).toBe("Perioden avslutad 25 okt");
    expect(periodEndedOnSv(null)).toBe("Perioden avslutad");
  });
});
