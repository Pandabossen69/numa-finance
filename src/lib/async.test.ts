import { describe, expect, it } from "vitest";
import { isTimeoutError, loadErrorMessageSv, LOAD_TIMEOUT_MESSAGE_SV } from "./async";

describe("loadErrorMessageSv", () => {
  it("hides raw snapshot timeout strings from the UI", () => {
    const error = new Error("getTodaySnapshot timed out after 3500ms");
    expect(isTimeoutError(error)).toBe(true);
    expect(loadErrorMessageSv(error, "Kunde inte hämta din ekonomi")).toBe(
      LOAD_TIMEOUT_MESSAGE_SV,
    );
  });

  it("keeps ordinary errors", () => {
    expect(loadErrorMessageSv(new Error("Du måste vara inloggad"), "x")).toBe(
      "Du måste vara inloggad",
    );
  });
});
