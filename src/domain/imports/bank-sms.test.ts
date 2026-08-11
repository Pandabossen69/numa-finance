import { describe, expect, it } from "vitest";
import {
  BangkokBankSmsParser,
  majorStringToMinor,
  orderNewestFirst,
  selectImportableBankEvent,
  toBankEventCandidate,
} from "./bank-parsers";
import { resolveScreenshotImport } from "./resolve-screenshot-import";
import { buildTransactionFingerprint } from "@/domain/finance/fingerprint";

const SMS_A =
  "Withdrawal/transfer/payment from your account X6591 of Bt 750.00 via MOBILE; the available balance is Bt 10,758.04.";
const SMS_B =
  "Withdrawal/transfer/payment from your account X6591 of Bt 65.00 via MOBILE; the available balance is Bt 10,693.04.";
const SMS_C =
  "Withdrawal/transfer/payment from your account X6591 of Bt 120.00 via MOBILE; the available balance is Bt 10,573.04.";
const SMS_SHORT =
  "Withdrawal from your account X6591 of Bt 50.00 via MOBILE; the available balance is Bt 12,118.04.";
const SMS_CREDIT =
  "PromptPay transfer to your account X6591 of Bt 3,400.00 via MOBILE; the available balance is Bt 10,108.04";
const SMS_CREDIT_TH =
  "MoneyPlus transfer to your account 4181 of TH 3,400.00 via MOBILE; the available balance is TH 7,144.44.";
const SMS_ATM =
  "Withdrawal/transfer/payment from your account X6591 of Bt 5,000.00 via ATM; the available balance is Bt 7,028.04.";
const SMS_USER_THREAD = `${SMS_ATM}

${SMS_CREDIT}`;
const SMS_TH_THREAD = `Withdrawal/transfer/payment from your account 4181 of TH 220.00 via MOBILE; the available balance is TH 3,744.44.

${SMS_CREDIT_TH}`;

describe("bangkok bank multi-SMS", () => {
  it("parses western bank amount strings into minor units", () => {
    expect(majorStringToMinor("10,058.04")).toBe(1005804);
    expect(majorStringToMinor("750.00")).toBe(75000);
    expect(majorStringToMinor("3,400.00")).toBe(340000);
  });

  it("parses short Withdrawal and PromptPay credit", () => {
    const parser = new BangkokBankSmsParser();
    const debit = parser.parse({
      institution: "Bangkok Bank",
      text: SMS_SHORT,
    })[0];
    expect(debit?.direction).toBe("debit");
    expect(debit?.amountMinor).toBe(5000);
    expect(debit?.balanceAfterMinor).toBe(1211804);
    expect(debit?.channel).toBe("mobile");

    const credit = parser.parse({
      institution: "Bangkok Bank",
      text: SMS_CREDIT,
    })[0];
    expect(credit?.direction).toBe("credit");
    expect(credit?.amountMinor).toBe(340000);
    expect(credit?.balanceAfterMinor).toBe(1010804);
    expect(credit?.maskedAccount).toBe("6591");
  });

  it("first import tip is PromptPay credit — saldo = available balance", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: SMS_USER_THREAD,
    });
    const result = selectImportableBankEvent(parsed, []);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.selected.direction).toBe("credit");
    expect(result.selected.amountMinor).toBe(340_000);
    // This is what becomes Hem saldo / checkpoint
    expect(result.selected.balanceAfterMinor).toBe(1_010_804);
    expect(result.updatesBalance).toBe(true);
    expect(result.skippedOlderCount).toBe(1);
  });

  it("parses MoneyPlus credit with TH currency (not Bt)", () => {
    const parser = new BangkokBankSmsParser();
    const credit = parser.parse({
      institution: "Bangkok Bank",
      text: SMS_CREDIT_TH,
    })[0];
    expect(credit?.direction).toBe("credit");
    expect(credit?.amountMinor).toBe(340_000);
    expect(credit?.balanceAfterMinor).toBe(714_444);
    expect(credit?.maskedAccount).toBe("4181");
  });

  it("first import with TH thread — tip MoneyPlus 3400, saldo = available balance", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: SMS_TH_THREAD,
    });
    expect(parsed.length).toBeGreaterThanOrEqual(2);
    const result = selectImportableBankEvent(parsed, []);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.selected.direction).toBe("credit");
    expect(result.selected.amountMinor).toBe(340_000);
    expect(result.selected.balanceAfterMinor).toBe(714_444);
  });

  it("picks newest credit after ATM debit in one screenshot", () => {
    const parser = new BangkokBankSmsParser();
    const text = `${SMS_ATM}\n\n${SMS_CREDIT}`;
    const parsed = parser.parse({ institution: "Bangkok Bank", text });
    const result = selectImportableBankEvent(parsed, []);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.selected.direction).toBe("credit");
    expect(result.selected.amountMinor).toBe(340000);
    expect(result.selected.balanceAfterMinor).toBe(1010804);
  });

  it("does not re-import the same SMS from a second screenshot", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: SMS_CREDIT,
    });
    const fp = buildTransactionFingerprint({
      institution: "Bangkok Bank",
      maskedAccount: "6591",
      direction: "credit",
      amountMinor: 340000,
      balanceAfterMinor: 1010804,
      channel: "mobile",
    }).fingerprint;
    const again = selectImportableBankEvent(parsed, [fp]);
    expect(again.status).toBe("all_known");
  });

  it("splits and parses several SMS in one screenshot text", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: `${SMS_A}\n\n${SMS_B}\n\n${SMS_C}`,
    });
    expect(parsed).toHaveLength(3);
    expect(parsed.map((p) => p.amountMinor)).toEqual([75000, 6500, 12000]);
    expect(parsed[1]?.balanceAfterMinor).toBe(1069304);
    expect(parsed[0]?.maskedAccount).toBe("6591");
  });

  it("orders newest first using balance-after chain", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: `${SMS_A}\n\n${SMS_B}\n\n${SMS_C}`,
    });
    const ordered = orderNewestFirst(parsed.map(toBankEventCandidate));
    // C happened after B after A (balances: 10758 → 10693 → 10573)
    expect(ordered[0]?.amountMinor).toBe(12000);
    expect(ordered[1]?.amountMinor).toBe(6500);
    expect(ordered[2]?.amountMinor).toBe(75000);
  });

  it("imports only the newest unknown SMS", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: `${SMS_A}\n\n${SMS_B}\n\n${SMS_C}`,
    });

    const knownOlder = parsed
      .filter((p) => p.amountMinor !== 12000)
      .map((p) =>
        buildTransactionFingerprint({
          institution: p.institution,
          maskedAccount: p.maskedAccount!,
          direction: "debit",
          amountMinor: p.amountMinor!,
          balanceAfterMinor: p.balanceAfterMinor,
          channel: p.channel,
        }).fingerprint,
      );

    const result = selectImportableBankEvent(parsed, knownOlder);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.selected.amountMinor).toBe(12000);
    expect(result.skippedDuplicateCount).toBe(0);
    expect(result.skippedOlderCount).toBe(2);
    expect(result.messageSv).toMatch(/Senaste nya/i);
  });

  it("skips import entirely when newest SMS is already known", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: `${SMS_A}\n\n${SMS_B}\n\n${SMS_C}`,
    });
    const newest = parsed.find((p) => p.amountMinor === 12000)!;
    const knownNewest = [
      buildTransactionFingerprint({
        institution: newest.institution,
        maskedAccount: newest.maskedAccount!,
        direction: "debit",
        amountMinor: newest.amountMinor!,
        balanceAfterMinor: newest.balanceAfterMinor,
        channel: null,
      }).fingerprint,
    ];
    const result = selectImportableBankEvent(parsed, knownNewest);
    expect(result.status).toBe("all_known");
    if (result.status !== "all_known") return;
    expect(result.messageSv).toMatch(/Senaste SMS finns redan/i);
  });

  it("reports all_known when every SMS fingerprint exists", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: `${SMS_A}\n\n${SMS_B}`,
    });
    const fps = parsed.map(
      (p) =>
        buildTransactionFingerprint({
          institution: p.institution,
          maskedAccount: p.maskedAccount!,
          direction: "debit",
          amountMinor: p.amountMinor!,
          balanceAfterMinor: p.balanceAfterMinor,
          channel: p.channel,
        }).fingerprint,
    );
    const result = selectImportableBankEvent(parsed, fps);
    expect(result.status).toBe("all_known");
  });

  it("resolveScreenshotImport prefers latest unknown from vision metadata", () => {
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          detectedKind: "bangkok_bank_sms",
          fullText: `${SMS_A}\n\n${SMS_B}`,
          smsTexts: [SMS_A, SMS_B],
        },
      },
      [],
    );
    expect(resolved.kind).toBe("bank_sms");
    expect(resolved.alreadyKnown).toBe(false);
    expect(resolved.suggestedAmountMinor).toBe(6500);
    expect(resolved.fingerprint).toContain("balanceAfter=1069304");
  });
});
