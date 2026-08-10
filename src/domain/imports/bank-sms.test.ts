import { describe, expect, it } from "vitest";
import { BangkokBankSmsParser } from "./bank-parsers";
import {
  buildBankSmsCandidates,
  latestBalanceAfterMinor,
} from "./bank-sms";

const SAMPLE_THREAD = `
PromptPay transfer to your account X6591 of Bt 1,000.00; the available balance is Bt 11,508.04.

Withdrawal/transfer/payment from your account X6591 of Bt 750.00 via MOBILE; the available balance is Bt 10,758.04.

Withdrawal/transfer/payment from your account X6591 of Bt 65.00 via MOBILE; the available balance is Bt 10,693.04.

Withdrawal/transfer/payment from your account X6591 of Bt 35.00 via MOBILE; the available balance is Bt 10,658.04.

Withdrawal/transfer/payment from your account X6591 of Bt 600.00 via MOBILE; the available balance is Bt 10,058.04.
`;

describe("buildBankSmsCandidates", () => {
  it("parses a multi-SMS Bangkok Bank screenshot dump with balances", () => {
    const candidates = buildBankSmsCandidates({
      text: SAMPLE_THREAD,
      existingFingerprints: [],
    });

    expect(candidates).toHaveLength(5);
    expect(candidates.map((c) => c.amountMinor)).toEqual([
      100000, 75000, 6500, 3500, 60000,
    ]);
    expect(candidates.map((c) => c.balanceAfterMinor)).toEqual([
      1150804, 1075804, 1069304, 1065804, 1005804,
    ]);
    expect(candidates[0]?.direction).toBe("credit");
    expect(candidates.slice(1).every((c) => c.direction === "debit")).toBe(
      true,
    );
    expect(candidates.every((c) => c.fingerprintConfidence === "high")).toBe(
      true,
    );
    expect(candidates.every((c) => !c.duplicate)).toBe(true);
    expect(latestBalanceAfterMinor(candidates)).toBe(1005804);
  });

  it("marks exact fingerprint matches as duplicates without needing a date", () => {
    const firstPass = buildBankSmsCandidates({
      text: SAMPLE_THREAD,
      existingFingerprints: [],
    });
    const fp65 = firstPass.find((c) => c.amountMinor === 6500)?.fingerprint;
    expect(fp65).toBeTruthy();

    const secondPass = buildBankSmsCandidates({
      text: SAMPLE_THREAD,
      existingFingerprints: [fp65!],
    });

    const again65 = secondPass.find((c) => c.amountMinor === 6500);
    expect(again65?.duplicate).toBe(true);
    expect(secondPass.filter((c) => !c.duplicate)).toHaveLength(4);
  });

  it("keeps same-amount payments distinct when balance-after differs", () => {
    const text = [
      "Withdrawal/transfer/payment from your account X6591 of Bt 100.00 via MOBILE; the available balance is Bt 1,000.00.",
      "Withdrawal/transfer/payment from your account X6591 of Bt 100.00 via MOBILE; the available balance is Bt 900.00.",
    ].join("\n\n");

    const candidates = buildBankSmsCandidates({
      text,
      existingFingerprints: [],
    });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.fingerprint).not.toBe(candidates[1]!.fingerprint);

    const afterFirst = buildBankSmsCandidates({
      text,
      existingFingerprints: [candidates[0]!.fingerprint],
    });
    expect(afterFirst[0]?.duplicate).toBe(true);
    expect(afterFirst[1]?.duplicate).toBe(false);
  });
});

describe("BangkokBankSmsParser PromptPay credit", () => {
  it("treats PromptPay transfer to account as credit", () => {
    const parsed = new BangkokBankSmsParser().parse({
      institution: "Bangkok Bank",
      text: "PromptPay transfer to your account X6591 of Bt 1,000.00; the available balance is Bt 11,508.04.",
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.direction).toBe("credit");
    expect(parsed[0]?.amountMinor).toBe(100000);
    expect(parsed[0]?.balanceAfterMinor).toBe(1150804);
  });
});
