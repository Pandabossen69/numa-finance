import { describe, expect, it } from "vitest";
import {
  isTimeoutError,
  loadErrorMessageSv,
  LOAD_TIMEOUT_MESSAGE_SV,
  withTimeoutRetry,
} from "./async";

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

describe("withTimeoutRetry", () => {
  it("retries a timed-out start function once", async () => {
    let n = 0;
    const result = await withTimeoutRetry(
      async () => {
        n += 1;
        if (n === 1) {
          await new Promise((resolve) => setTimeout(resolve, 40));
          return "late";
        }
        return "ok";
      },
      15,
      "snap",
      1,
    );
    expect(result).toBe("ok");
    expect(n).toBe(2);
  });

  it("does not retry ordinary errors", async () => {
    let n = 0;
    await expect(
      withTimeoutRetry(
        async () => {
          n += 1;
          throw new Error("Du måste vara inloggad");
        },
        50,
        "snap",
        1,
      ),
    ).rejects.toThrow("Du måste vara inloggad");
    expect(n).toBe(1);
  });
});
