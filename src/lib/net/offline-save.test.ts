import { afterEach, describe, expect, it } from "vitest";
import {
  OFFLINE_SAVE_MESSAGE_SV,
  isOfflineSaveError,
  offlineSaveMessage,
  userFacingSaveError,
} from "./offline-save";

describe("offline save errors", () => {
  afterEach(() => {
    if (typeof navigator !== "undefined") {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
    }
  });

  it("maps fetch TypeErrors and the browser's offline flag", () => {
    expect(offlineSaveMessage(new TypeError("Failed to fetch"))).toBe(
      OFFLINE_SAVE_MESSAGE_SV,
    );
    expect(
      offlineSaveMessage(
        new TypeError("NetworkError when attempting to fetch resource."),
      ),
    ).toBe(OFFLINE_SAVE_MESSAGE_SV);
    expect(offlineSaveMessage(new TypeError("Load failed"))).toBe(
      OFFLINE_SAVE_MESSAGE_SV,
    );
    expect(offlineSaveMessage("Failed to fetch")).toBe(OFFLINE_SAVE_MESSAGE_SV);
    expect(isOfflineSaveError(new TypeError("Load failed"))).toBe(true);

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    expect(offlineSaveMessage(new Error("socket hang up"))).toBe(
      OFFLINE_SAVE_MESSAGE_SV,
    );
  });

  it("leaves validation and server copy alone while online", () => {
    expect(offlineSaveMessage(new TypeError("x is not a function"))).toBeNull();
    expect(offlineSaveMessage(new Error("Ogiltigt belopp"))).toBeNull();
    expect(userFacingSaveError("Kunde inte spara kontot", "fallback")).toBe(
      "Kunde inte spara kontot",
    );
    expect(userFacingSaveError(new TypeError("Failed to fetch"), "fallback")).toBe(
      OFFLINE_SAVE_MESSAGE_SV,
    );
    expect(userFacingSaveError(new Error(""), "Kunde inte spara")).toBe(
      "Kunde inte spara",
    );
  });
});
