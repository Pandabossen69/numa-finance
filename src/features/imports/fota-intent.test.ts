import { afterEach, describe, expect, it } from "vitest";
import {
  fotaIntentFromHref,
  lastFotaIntent,
  rememberFotaIntentFromHref,
  resetFotaIntentForTests,
} from "./fota-intent";

afterEach(() => {
  resetFotaIntentForTests();
});

describe("fota SPA intent", () => {
  it("reads mode and observation from the href", () => {
    expect(fotaIntentFromHref("/fota")).toEqual({
      mode: "pick",
      observationId: null,
    });
    expect(fotaIntentFromHref("/fota?mode=sms")).toEqual({
      mode: "bank_sms",
      observationId: null,
    });
    expect(
      fotaIntentFromHref(
        "/fota?mode=receipt&observation=11111111-1111-1111-1111-111111111111",
      ),
    ).toEqual({
      mode: "receipt",
      observationId: "11111111-1111-1111-1111-111111111111",
    });
    expect(fotaIntentFromHref("/fota?observation=not-a-uuid")).toEqual({
      mode: "pick",
      observationId: null,
    });
  });

  it("keeps ?mode= through SPA hrefs that only flip the Fota panel", () => {
    rememberFotaIntentFromHref("/fota?mode=bank_sms");
    expect(lastFotaIntent().mode).toBe("bank_sms");
    rememberFotaIntentFromHref("/idag");
    expect(lastFotaIntent().mode).toBe("bank_sms");
    rememberFotaIntentFromHref("/fota");
    expect(lastFotaIntent()).toEqual({ mode: "pick", observationId: null });
  });
});
