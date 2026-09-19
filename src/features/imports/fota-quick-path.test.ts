import { afterEach, describe, expect, it } from "vitest";
import {
  FASTEST_CAPTURE_METHOD,
  FOTA_QUICK_PATH_COPY,
  LAST_CAPTURE_METHOD_KEY,
  fotaPickerMark,
  readLastCaptureMethod,
  rememberLastCaptureMethod,
  resetLastCaptureMethodCache,
  subscribeLastCaptureMethod,
} from "./fota-quick-path";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

function mockLocalStorage() {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
}

afterEach(() => {
  resetLastCaptureMethodCache();
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("fota quick path", () => {
  it("marks bank-SMS as the fastest first action", () => {
    expect(FASTEST_CAPTURE_METHOD).toBe("bank_sms");
    expect(fotaPickerMark("bank_sms", null)).toBe(FOTA_QUICK_PATH_COPY.fastest);
    expect(FOTA_QUICK_PATH_COPY.fastest).toBe("Snabbast");
  });

  it("shows last-used when known, without hiding other methods", () => {
    expect(fotaPickerMark("receipt", "receipt")).toBe(
      FOTA_QUICK_PATH_COPY.lastUsed,
    );
    expect(fotaPickerMark("bank_app", "receipt")).toBeNull();
    expect(fotaPickerMark("manual", "manual")).toBe("Senast");
    expect(fotaPickerMark("bank_sms", "receipt")).toBe("Snabbast");
    expect(fotaPickerMark("bank_sms", "bank_sms")).toBe(
      FOTA_QUICK_PATH_COPY.fastestAndLast,
    );
  });

  it("remembers a chosen capture method", () => {
    mockLocalStorage();
    expect(readLastCaptureMethod()).toBeNull();
    rememberLastCaptureMethod("pick");
    expect(readLastCaptureMethod()).toBeNull();
    rememberLastCaptureMethod("receipt");
    expect(readLastCaptureMethod()).toBe("receipt");
    expect(globalThis.localStorage.getItem(LAST_CAPTURE_METHOD_KEY)).toBe(
      "receipt",
    );
    rememberLastCaptureMethod("bank_sms");
    expect(readLastCaptureMethod()).toBe("bank_sms");
  });

  it("notifies same-tab subscribers so Senast appears after a pick", () => {
    mockLocalStorage();
    let hits = 0;
    const stop = subscribeLastCaptureMethod(() => {
      hits += 1;
    });
    rememberLastCaptureMethod("receipt");
    expect(hits).toBe(1);
    expect(readLastCaptureMethod()).toBe("receipt");
    expect(fotaPickerMark("receipt", readLastCaptureMethod())).toBe("Senast");
    expect(fotaPickerMark("bank_sms", readLastCaptureMethod())).toBe("Snabbast");
    stop();
  });

  it("keeps last-used in memory when localStorage is missing", () => {
    rememberLastCaptureMethod("manual");
    expect(readLastCaptureMethod()).toBe("manual");
    expect(fotaPickerMark("manual", readLastCaptureMethod())).toBe("Senast");
  });

  it("ignores junk in storage", () => {
    mockLocalStorage();
    globalThis.localStorage.setItem(LAST_CAPTURE_METHOD_KEY, "camera");
    expect(readLastCaptureMethod()).toBeNull();
  });
});
