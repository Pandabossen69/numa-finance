import { describe, expect, it } from "vitest";
import {
  DAGSBUDGET_BILLS_EXCEED_SALDO_SV,
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
