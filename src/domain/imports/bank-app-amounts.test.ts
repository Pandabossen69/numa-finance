import { describe, expect, it } from "vitest";
import {
  cleanBankAppMerchant,
  collectBankAppAmountCandidates,
  importEventDescription,
  reconcileBankAppAmountMinor,
} from "./bank-app-amounts";
import {
  parseBankAppVisionRows,
  parseBunqDetailFromText,
  selectImportableBankAppEvents,
} from "./bank-app-parsers";
import { presentAlreadyKnownMessage } from "./movement-count-copy";
import { resolveScreenshotImport } from "./resolve-screenshot-import";

const capturedAt = new Date("2026-09-27T12:00:00.000Z");

function kasikornScreen(clock: string, merchant = "7-Eleven Z4C QA"): string {
  return [
    "Kasikorn K PLUS",
    "Transaction details",
    merchant,
    "-63.00 THB",
    `25 sep. 2026 ${clock}`,
    "Completed",
  ].join("\n");
}

function clockAsMajor(clock: string): number {
  const [hours, minutes] = clock.split(/[:.]/).map(Number);
  return hours! + minutes! / 100;
}

function visionOf(clock: string, amountMajor: number | string | null) {
  const text = kasikornScreen(clock);
  return parseBankAppVisionRows(
    [
      {
        merchant: "7-Eleven Z4C QA",
        direction: "debit",
        amountMajor,
        currency: "THB",
        occurredAt: `25 sep. 2026 ${clock}`,
        rawText: "-63.00 THB",
      },
    ],
    { fullText: text, capturedAt },
  );
}

describe("bank-app amount fixtures", () => {
  it("drops 05:30, 11:30, 23:45 and 00:15 beside a date and keeps 63,00 THB", () => {
    for (const clock of ["05:30", "11:30", "23:45", "00:15"]) {
      const { candidates, clockMinors } = collectBankAppAmountCandidates(
        kasikornScreen(clock),
      );
      expect(clockMinors.size).toBeGreaterThan(0);
      expect(candidates.map((c) => c.amountMinor)).toEqual([6_300]);
      expect(visionOf(clock, clockAsMajor(clock))[0]?.amountMinor).toBe(6_300);
    }
  });

  it("drops the same clocks written with a dot", () => {
    for (const clock of ["05.30", "11.30", "23.45", "00.15"]) {
      const { candidates, clockMinors } = collectBankAppAmountCandidates(
        kasikornScreen(clock),
      );
      expect(clockMinors.size).toBeGreaterThan(0);
      expect(candidates.map((c) => c.amountMinor)).toEqual([6_300]);
      const rows = visionOf(clock, clockAsMajor(clock));
      expect(rows[0]?.amountMinor).toBe(6_300);
      expect(rows[0]?.currency).toBe("THB");
    }
  });

  it("still reads 63,00 THB when the clock is 11:02", () => {
    const rows = visionOf("11:02", 63);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountMinor).toBe(6_300);
    expect(rows[0]?.merchant).toBe("7-Eleven Z4C QA");
    const selected = selectImportableBankAppEvents(rows, []);
    expect(selected.status).toBe("ready");
  });

  it("drops HH.mm beside kl, a weekday, an ISO date and a numeric date", () => {
    const samples = [
      "kl 11.30\n63,00 THB",
      "måndag 23.45\n63,00 kr",
      "2026-09-25 00.15\n30.00",
      "25/09/2026 05.30\n−1 234,50 kr",
    ];
    const expected = [6_300, 6_300, 3_000, 123_450];
    samples.forEach((text, index) => {
      const { clockMinors } = collectBankAppAmountCandidates(text);
      expect(clockMinors.size).toBeGreaterThan(0);
      expect(
        reconcileBankAppAmountMinor({ visionMinor: null, text }).amountMinor,
      ).toBe(expected[index]);
    });
  });

  it("replaces a bare clock copy when the screen has the real amount", () => {
    const screen = kasikornScreen("05:30");
    const rows = parseBankAppVisionRows(
      [
        {
          merchant: "7-Eleven Z4C QA",
          direction: "debit",
          amountMajor: 5.3,
          currency: "THB",
          occurredAt: "05:30",
          rawText: "5.30",
        },
      ],
      { fullText: screen, capturedAt },
    );
    expect(rows[0]?.amountMinor).toBe(6_300);
    expect(rows[0]?.currency).toBe("THB");
  });

  it("reads a line with an amount and no clock", () => {
    const text = "7-Eleven\n-63.00 THB\nCompleted";
    const { candidates, clockMinors } = collectBankAppAmountCandidates(text);
    expect(clockMinors.size).toBe(0);
    expect(candidates.map((c) => c.amountMinor)).toEqual([6_300]);
    expect(
      reconcileBankAppAmountMinor({ visionMinor: null, text }).amountMinor,
    ).toBe(6_300);
  });

  it("keeps a real amount that is not a clock", () => {
    expect(
      reconcileBankAppAmountMinor({
        visionMinor: null,
        text: "Kvitto\n30.00",
      }).amountMinor,
    ).toBe(3_000);
    expect(
      reconcileBankAppAmountMinor({
        visionMinor: null,
        text: "Belopp\n−1 234,50 kr",
      }).amountMinor,
    ).toBe(123_450);
    expect(
      collectBankAppAmountCandidates("25 sep. 2026 11:30\n63,00 THB").candidates[0]
        ?.amountMinor,
    ).toBe(6_300);
  });

  it("does not let a clock replace a real card amount", () => {
    const text = "Grab\n23 juli 2026 16:46\n6,60 €\n248.00 THB";
    expect(
      reconcileBankAppAmountMinor({ visionMinor: 660, text }).amountMinor,
    ).toBe(660);
  });
});

describe("bank-app merchant cleanup", () => {
  it("strips the utgift prefix, amount and currency", () => {
    expect(
      cleanBankAppMerchant("− Utgift 63,00 THB · 7-Eleven Z4C QA"),
    ).toBe("7-Eleven Z4C QA");
    expect(cleanBankAppMerchant("7-Eleven Z4C QA")).toBe("7-Eleven Z4C QA");
    expect(cleanBankAppMerchant("+ Payment 12.50 USD · Starbucks")).toBe(
      "Starbucks",
    );
    expect(cleanBankAppMerchant("− Insättning 1 234,50 kr · Lön")).toBe("Lön");
    expect(cleanBankAppMerchant("− Utgift")).toBeNull();
    expect(cleanBankAppMerchant("Expense 30.00")).toBeNull();
  });

  it("saves the merchant instead of the prefixed label", () => {
    const rows = parseBankAppVisionRows(
      [
        {
          merchant: "− Utgift 63,00 THB · 7-Eleven Z4C QA",
          direction: "debit",
          amountMajor: 5.3,
          currency: "THB",
          occurredAt: "25 sep. 2026 05:30",
          rawText: "-63.00 THB",
        },
      ],
      { fullText: kasikornScreen("05:30"), capturedAt },
    );
    expect(rows[0]?.merchant).toBe("7-Eleven Z4C QA");
    expect(rows[0]?.amountMinor).toBe(6_300);
    const selected = selectImportableBankAppEvents(rows, []);
    expect(selected.status).toBe("ready");
    if (selected.status !== "ready") return;
    expect(importEventDescription(selected.selectedBatch[0]!)).toBe(
      "7-Eleven Z4C QA",
    );
    expect(importEventDescription({ labelSv: "− Utgift 50,00 THB" })).toBe(
      "− Utgift 50,00 THB",
    );
  });
});

const RECEIPT_FAIL = "Kunde inte läsa beloppet säkert";

function kasikornExtraction(
  text: string,
  input: {
    merchant: string;
    amountMajor: number;
    occurredAt: string;
  },
) {
  return {
    provider: "vision_api" as const,
    candidates: [],
    rawMetadata: {
      detectedKind: "receipt",
      fullText: text,
      transactions: [
        {
          merchant: input.merchant,
          direction: "debit" as const,
          amountMajor: input.amountMajor,
          currency: null,
          occurredAt: input.occurredAt,
          rawText: text,
        },
      ],
    },
  };
}

describe("Kasikorn screenshots z4c z4h z4e z4g", () => {
  const shots = {
    z4c: {
      merchant: "7-Eleven Z4C QA",
      amount: "−63.00 THB",
      when: "25 sep. 2026 11:02",
      minor: 6_300,
    },
    z4h: {
      merchant: "7-Eleven Z4C QA",
      amount: "−63.00 THB",
      when: "25 sep. 2026 05:30",
      minor: 6_300,
    },
    z4g: {
      merchant: "7-Eleven Z4G QA",
      amount: "−63.00 THB",
      when: "26 sep. 2026 05:30",
      minor: 6_300,
    },
    z4e: {
      merchant: "Grab Z4E QA",
      amount: "−64.00 THB",
      when: "26 sep. 2026 11:30",
      minor: 6_400,
    },
  } as const;

  function screen(id: keyof typeof shots): string {
    const shot = shots[id];
    return [
      "Kasikorn K PLUS",
      "Transaction details",
      shot.merchant,
      shot.amount,
      shot.when,
      "2026",
      "25",
      "Completed",
    ].join("\n");
  }

  it("reads each screenshot even when vision returns the year", () => {
    for (const id of ["z4c", "z4h", "z4g", "z4e"] as const) {
      const shot = shots[id];
      const text = screen(id);
      const resolved = resolveScreenshotImport(
        kasikornExtraction(text, {
          merchant: `− Utgift ${shot.amount} · ${shot.merchant}`,
          amountMajor: 2026,
          occurredAt: shot.when,
        }),
        [],
        { preferBankApp: true },
      );
      expect(resolved.kind).toBe("bank_app");
      expect(resolved.suggestedAmountMinor).toBe(shot.minor);
      expect(resolved.suggestedDescription).toBe(shot.merchant);
      expect(resolved.messageSv).not.toContain(RECEIPT_FAIL);
    }
  });

  it("does not treat 05:30 on the same day as the saved 11:02 row", () => {
    const z4c = resolveScreenshotImport(
      kasikornExtraction(screen("z4c"), {
        merchant: shots.z4c.merchant,
        amountMajor: 63,
        occurredAt: shots.z4c.when,
      }),
      [],
      { preferBankApp: true },
    );
    expect(z4c.kind).toBe("bank_app");
    if (z4c.kind !== "bank_app" || !z4c.fingerprint) return;
    const z4h = resolveScreenshotImport(
      kasikornExtraction(screen("z4h"), {
        merchant: shots.z4h.merchant,
        amountMajor: 5.3,
        occurredAt: shots.z4h.when,
      }),
      [z4c.fingerprint],
      { preferBankApp: true },
    );
    expect(z4h.kind).toBe("bank_app");
    expect(z4h.alreadyKnown).toBe(false);
    expect(z4h.suggestedAmountMinor).toBe(6_300);
    expect(z4h.messageSv).not.toContain(RECEIPT_FAIL);
  });

  it("names an already imported duplicate instead of the receipt error", () => {
    const first = resolveScreenshotImport(
      kasikornExtraction(screen("z4c"), {
        merchant: shots.z4c.merchant,
        amountMajor: 11.02,
        occurredAt: shots.z4c.when,
      }),
      [],
      { preferBankApp: true },
    );
    expect(first.kind).toBe("bank_app");
    if (first.kind !== "bank_app" || !first.fingerprint) return;
    const again = resolveScreenshotImport(
      kasikornExtraction(screen("z4c"), {
        merchant: shots.z4c.merchant,
        amountMajor: 2026,
        occurredAt: shots.z4c.when,
      }),
      [first.fingerprint],
      { preferBankApp: true },
    );
    expect(again.kind).toBe("bank_app");
    expect(again.alreadyKnown).toBe(true);
    expect(again.messageSv).toBe(
      "Den här transaktionen finns redan (25 sep, 63,00 THB).",
    );
    expect(again.messageSv).not.toContain(RECEIPT_FAIL);
    expect(
      presentAlreadyKnownMessage({
        listedCount: 1,
        serverMessage: again.messageSv,
      }),
    ).toBe(again.messageSv);
  });

  it("keeps an unreadable Bankapp shot off the receipt sentence", () => {
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          detectedKind: "receipt",
          fullText: "oklar skärm",
          transactions: [],
        },
      },
      [],
      { preferBankApp: true },
    );
    expect(resolved.kind).toBe("bank_app");
    expect(resolved.messageSv).not.toContain(RECEIPT_FAIL);
  });
});

describe("Kasikorn bank-app screenshots", () => {
  it("imports 05:30 and 11:30 instead of rejecting them", () => {
    for (const [clock, amountMajor] of [
      ["05:30", 5.3],
      ["11:30", 11.3],
      ["05.30", "05.30"],
      ["11:02", 63],
    ] as const) {
      const text = kasikornScreen(clock);
      const resolved = resolveScreenshotImport(
        {
          provider: "vision_api",
          candidates: [],
          rawMetadata: {
            detectedKind: "bank_app_detail",
            fullText: text,
            transactions: [
              {
                merchant: "− Utgift 63,00 THB · 7-Eleven Z4C QA",
                direction: "debit",
                amountMajor,
                currency: "THB",
                occurredAt: `25 sep. 2026 ${clock}`,
                rawText: "-63.00 THB",
              },
            ],
          },
        },
        [],
        { preferBankApp: true },
      );
      expect(resolved.kind).toBe("bank_app");
      expect(resolved.suggestedAmountMinor).toBe(6_300);
      expect(resolved.suggestedDescription).toBe("7-Eleven Z4C QA");
      expect(resolved.messageSv).not.toContain("Kunde inte läsa beloppet säkert");
    }
  });

  it("reads the THB amount when Bankapp mode is not classified as a bank app", () => {
    const text = kasikornScreen("05:30");
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          detectedKind: "receipt",
          fullText: text,
        },
      },
      [],
      { preferBankApp: true },
    );
    expect(resolved.kind).toBe("bank_app");
    expect(resolved.suggestedAmountMinor).toBe(6_300);
    expect(resolved.suggestedDescription).toBe("7-Eleven Z4C QA");
    expect(parseBunqDetailFromText(text, { capturedAt })[0]?.merchant).toBe(
      "7-Eleven Z4C QA",
    );
  });
});
