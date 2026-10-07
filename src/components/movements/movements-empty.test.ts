import { describe, expect, it } from "vitest";
import {
  MOVEMENTS_EMPTY_FILTER,
  MOVEMENTS_EMPTY_LEDGER,
  movementsEmptyCopy,
  movementsEmptyKind,
} from "./movements-empty";

const base = {
  itemCount: 0,
  filter: "all" as const,
  period: "month" as const,
  category: null,
};

describe("Rörelser empty copy", () => {
  it("says there are no movements yet when the ledger is empty, even with Alla", () => {
    expect(movementsEmptyCopy(base)).toBe("Inga rörelser än");
    expect(movementsEmptyCopy({ ...base, filter: "expense" })).toBe(
      MOVEMENTS_EMPTY_LEDGER,
    );
    expect(
      movementsEmptyKind({ ...base, itemCount: 4, filter: "all", period: "month" }),
    ).toBe("ledger");
    expect(
      movementsEmptyCopy({ ...base, itemCount: 4, filter: "all", period: "all" }),
    ).toBe(MOVEMENTS_EMPTY_LEDGER);
  });

  it("keeps the filter hint when a type, category, or Perioden chip hides rows", () => {
    expect(movementsEmptyCopy({ ...base, itemCount: 3, filter: "expense" })).toBe(
      MOVEMENTS_EMPTY_FILTER,
    );
    expect(
      movementsEmptyCopy({
        ...base,
        itemCount: 3,
        filter: "all",
        category: "Mat",
      }),
    ).toBe(MOVEMENTS_EMPTY_FILTER);
    expect(
      movementsEmptyKind({
        ...base,
        itemCount: 3,
        filter: "all",
        period: "cycle",
      }),
    ).toBe("filter");
    expect(MOVEMENTS_EMPTY_FILTER).toContain("prova Alla");
  });
});
