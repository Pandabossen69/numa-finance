import { describe, expect, it } from "vitest";
import {
  captureAccountCandidates,
  chooseCaptureAccount,
  newCaptureAccountNotice,
  type CaptureAccountCandidate,
} from "./capture-account";

function account(
  partial: Partial<CaptureAccountCandidate> &
    Pick<CaptureAccountCandidate, "id" | "name" | "currency">,
): CaptureAccountCandidate {
  return {
    isActive: true,
    lastUsedAt: null,
    ...partial,
  };
}

const THAI = account({
  id: "thai",
  name: "Thai-bank",
  currency: "THB",
  lastUsedAt: "2026-09-25T08:00:00.000Z",
});
const TEST_SEK = account({
  id: "test-sek",
  name: "Test-SEK",
  currency: "SEK",
  lastUsedAt: "2026-09-20T08:00:00.000Z",
});

describe("chooseCaptureAccount", () => {
  it("keeps an active preselected account in the receipt currency", () => {
    const older = account({
      id: "old-sek",
      name: "Gammalt SEK",
      currency: "SEK",
      lastUsedAt: "2026-09-01T00:00:00.000Z",
    });
    const choice = chooseCaptureAccount({
      movementCurrency: "SEK",
      preselectedAccountId: older.id,
      accounts: [THAI, TEST_SEK, older],
    });
    expect(choice).toEqual({
      action: "use",
      accountId: "old-sek",
      name: "Gammalt SEK",
      currency: "SEK",
    });
  });

  it("uses the only active account in the receipt currency", () => {
    const choice = chooseCaptureAccount({
      movementCurrency: "sek",
      preselectedAccountId: THAI.id,
      accounts: [THAI, TEST_SEK],
    });
    expect(choice).toEqual({
      action: "use",
      accountId: "test-sek",
      name: "Test-SEK",
      currency: "SEK",
    });
  });

  it("picks the most recently used active account when several match", () => {
    const recent = account({
      id: "recent-sek",
      name: "Senaste SEK",
      currency: "SEK",
      lastUsedAt: "2026-09-24T12:00:00.000Z",
    });
    const choice = chooseCaptureAccount({
      movementCurrency: "SEK",
      preselectedAccountId: THAI.id,
      accounts: [THAI, TEST_SEK, recent],
    });
    expect(choice.action).toBe("use");
    if (choice.action !== "use") return;
    expect(choice.accountId).toBe("recent-sek");
  });

  it("ignores archived accounts even when they are the only currency match", () => {
    const archived = account({
      id: "old",
      name: "Arkiverat SEK",
      currency: "SEK",
      isActive: false,
      lastUsedAt: "2026-09-24T12:00:00.000Z",
    });
    const choice = chooseCaptureAccount({
      movementCurrency: "SEK",
      preselectedAccountId: archived.id,
      accounts: [THAI, archived],
    });
    expect(choice).toEqual({
      action: "create",
      name: "Bankapp",
      currency: "SEK",
      noticeSv: "Nytt konto skapas: Bankapp (SEK)",
    });
  });

  it("creates a new account only when no active account uses the currency", () => {
    const choice = chooseCaptureAccount({
      movementCurrency: "SEK",
      preselectedAccountId: THAI.id,
      accounts: [THAI],
      newAccountName: "Bankapp",
    });
    expect(choice.action).toBe("create");
    if (choice.action !== "create") return;
    expect(choice.noticeSv).toBe(newCaptureAccountNotice("Bankapp", "SEK"));
    expect(choice.noticeSv).toBe("Nytt konto skapas: Bankapp (SEK)");
  });
});

describe("captureAccountCandidates", () => {
  it("uses the latest non-voided transaction as last used", () => {
    const rows = captureAccountCandidates({
      accounts: [
        {
          id: "test-sek",
          name: "Test-SEK",
          currency: "SEK",
          isActive: true,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          accountId: "test-sek",
          occurredAt: "2026-09-01T00:00:00.000Z",
          status: "confirmed",
        },
        {
          accountId: "test-sek",
          occurredAt: "2026-09-24T00:00:00.000Z",
          status: "voided",
        },
        {
          accountId: "test-sek",
          occurredAt: "2026-09-20T00:00:00.000Z",
          status: "confirmed",
        },
      ],
    });
    expect(rows[0]?.lastUsedAt).toBe("2026-09-20T00:00:00.000Z");
  });
});
