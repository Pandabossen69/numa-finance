import { describe, expect, it } from "vitest";
import {
  alreadyKnownMovementsMessage,
  presentAlreadyKnownMessage,
  skippedFailedMovementsMessage,
  skippedSavedMovementsMessage,
} from "./movement-count-copy";

describe("already known movement copy", () => {
  it("uses singular for one row and plural for several", () => {
    expect(alreadyKnownMovementsMessage(1)).toBe("Den här rörelsen finns redan.");
    expect(alreadyKnownMovementsMessage(2)).toBe("Alla 2 rörelser finns redan.");
    expect(alreadyKnownMovementsMessage(3)).toBe("Alla 3 rörelser finns redan.");
  });

  it("replaces a stale count with the length of the list on screen", () => {
    expect(
      presentAlreadyKnownMessage({
        listedCount: 3,
        serverMessage: "Alla 2 rörelser finns redan sparade i NUMA.",
      }),
    ).toBe("Alla 3 rörelser finns redan.");
    expect(
      presentAlreadyKnownMessage({
        listedCount: 3,
        serverMessage: "Alla 2 rörelser finns redan.",
      }),
    ).not.toContain("2");
    expect(
      presentAlreadyKnownMessage({
        listedCount: 3,
        serverMessage:
          "Alla 2 rörelser finns redan. 1 misslyckad hoppades över.",
      }),
    ).toBe("Alla 3 rörelser finns redan. 1 misslyckad hoppades över.");
  });

  it("keeps a bank-app duplicate sentence that names the day and amount", () => {
    const sentence =
      "Den här transaktionen finns redan (7-Eleven, 63,00 THB, 25 sep).";
    expect(
      presentAlreadyKnownMessage({ listedCount: 1, serverMessage: sentence }),
    ).toBe(sentence);
    expect(
      presentAlreadyKnownMessage({
        listedCount: 1,
        serverMessage: "Den här rörelsen finns redan.",
      }),
    ).toBe("Den här rörelsen finns redan.");
  });

  it("keeps singular and plural on skipped rows", () => {
    expect(skippedSavedMovementsMessage(1)).toBe("1 redan sparad hoppades över.");
    expect(skippedSavedMovementsMessage(3)).toBe("3 redan sparade hoppades över.");
    expect(skippedFailedMovementsMessage(1)).toBe("1 misslyckad hoppades över.");
    expect(skippedFailedMovementsMessage(2)).toBe("2 misslyckade hoppades över.");
  });
});
