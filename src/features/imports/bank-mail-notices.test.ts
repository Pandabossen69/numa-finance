import { describe, expect, it } from "vitest";
import {
  BANK_MAIL_BEFORE_OPENING_NOTICE,
  BANK_MAIL_BEFORE_PLAN_NOTICE,
  bankMailDateNotices,
} from "@/features/imports/bank-mail-notices";
import { bankMailSavedToast } from "@/features/imports/bank-mail-toast";

const OPENING = "2026-09-01T00:00:00.000Z";

describe("bank mail date notices", () => {
  it("warns before the opening balance and before August 2026", () => {
    expect(
      bankMailDateNotices({
        occurredAt: "2026-01-03T04:08:05.000Z",
        openingBalanceAt: OPENING,
      }),
    ).toEqual([
      BANK_MAIL_BEFORE_OPENING_NOTICE,
      BANK_MAIL_BEFORE_PLAN_NOTICE,
    ]);
  });

  it("stays quiet on or after the opening date inside the plan window", () => {
    expect(
      bankMailDateNotices({
        occurredAt: OPENING,
        openingBalanceAt: OPENING,
      }),
    ).toEqual([]);
    expect(
      bankMailDateNotices({
        occurredAt: "2026-09-15T02:15:42.000Z",
        openingBalanceAt: OPENING,
      }),
    ).toEqual([]);
  });

  it("uses the Bangkok month, so late July UTC can already be August", () => {
    expect(
      bankMailDateNotices({
        occurredAt: "2026-07-31T20:00:00.000Z",
        openingBalanceAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual([]);
  });

  it("skips the saldo notice when the account has no opening checkpoint", () => {
    expect(
      bankMailDateNotices({
        occurredAt: "2026-01-03T04:08:05.000Z",
        openingBalanceAt: null,
      }),
    ).toEqual([BANK_MAIL_BEFORE_PLAN_NOTICE]);
  });

  it("formats the saved toast from merchant, amount and account", () => {
    expect(
      bankMailSavedToast({
        merchant: "MCD",
        amountLabel: "−312,50 THB",
        accountName: "Bangkok Bank",
      }),
    ).toBe("Sparat · MCD · −312,50 THB · Bangkok Bank");
  });
});
