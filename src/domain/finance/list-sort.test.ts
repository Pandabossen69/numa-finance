import { describe, expect, it } from "vitest";
import {
  compareNewestFirst,
  sortAccountsForList,
  sortCategoryNamesSv,
  sortNewestFirst,
  sortSpendDesc,
} from "./list-sort";

describe("sortNewestFirst", () => {
  it("orders by occurredAt descending", () => {
    const rows = [
      { id: "old", occurredAt: "2026-09-01T10:00:00.000Z", createdAt: "2026-09-01T10:00:00.000Z" },
      { id: "new", occurredAt: "2026-09-04T10:00:00.000Z", createdAt: "2026-09-04T10:00:00.000Z" },
      { id: "mid", occurredAt: "2026-09-03T10:00:00.000Z", createdAt: "2026-09-03T10:00:00.000Z" },
    ];
    expect(sortNewestFirst(rows).map((row) => row.id)).toEqual(["new", "mid", "old"]);
  });

  it("breaks same-day ties with createdAt then id", () => {
    const sameDay = "2026-09-04T00:00:00.000Z";
    const rows = [
      { id: "b", occurredAt: sameDay, createdAt: "2026-09-04T08:00:00.000Z" },
      { id: "a", occurredAt: sameDay, createdAt: "2026-09-04T08:00:00.000Z" },
      { id: "c", occurredAt: sameDay, createdAt: "2026-09-04T12:00:00.000Z" },
    ];
    expect(sortNewestFirst(rows).map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("is stable for the same inputs in any original order", () => {
    const rows = [
      { id: "z", occurredAt: "2026-09-04T10:00:00.000Z", createdAt: "2026-09-04T10:00:00.000Z" },
      { id: "a", occurredAt: "2026-09-04T10:00:00.000Z", createdAt: "2026-09-04T10:00:00.000Z" },
    ];
    expect(sortNewestFirst(rows).map((row) => row.id)).toEqual(
      sortNewestFirst([...rows].reverse()).map((row) => row.id),
    );
    expect(compareNewestFirst(rows[0]!, rows[1]!) > 0).toBe(true);
  });
});

describe("sortSpendDesc", () => {
  it("orders largest amount first, then Swedish name", () => {
    expect(
      sortSpendDesc([
        { name: "Övrigt", amountMinor: 100_00 },
        { name: "Åter", amountMinor: 100_00 },
        { name: "Mat", amountMinor: 400_00 },
        { name: "Boende", amountMinor: 200_00 },
      ]).map((row) => row.name),
    ).toEqual(["Mat", "Boende", "Åter", "Övrigt"]);
  });
});

describe("sortAccountsForList", () => {
  it("keeps the default account first, then Swedish name", () => {
    expect(
      sortAccountsForList([
        { id: "2", name: "Spar", isDefault: false },
        { id: "1", name: "Ålandsbanken", isDefault: false },
        { id: "0", name: "Nordea", isDefault: true },
        { id: "3", name: "Bangkok Bank", isDefault: false },
      ]).map((row) => row.name),
    ).toEqual(["Nordea", "Bangkok Bank", "Spar", "Ålandsbanken"]);
  });
});

describe("sortCategoryNamesSv", () => {
  it("sorts chip labels in Swedish alphabetical order", () => {
    expect(sortCategoryNamesSv(["Övrigt", "Mat", "Boende", "Åka"])).toEqual([
      "Boende",
      "Mat",
      "Åka",
      "Övrigt",
    ]);
  });
});
