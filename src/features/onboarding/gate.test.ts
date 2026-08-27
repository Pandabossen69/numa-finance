import { describe, expect, it } from "vitest";
import {
  needsSaldoOnboarding,
  pathForOnboardingPhase,
  resolveOnboardingPhase,
} from "./gate";
import {
  HOME_PATH,
  ONBOARDING_PLAN_PATH,
  ONBOARDING_SALDO_PATH,
  isOnboardingPath,
} from "./paths";

const empty = {
  email: "van@example.com",
  onboardingCompletedAt: null as string | null,
  onboardingSaldoAt: null as string | null,
  hasAccounts: false,
  hasSaldo: false,
};

describe("resolveOnboardingPhase", () => {
  it("sends a brand-new user to required saldo", () => {
    expect(resolveOnboardingPhase(empty)).toBe("saldo");
    expect(needsSaldoOnboarding(empty)).toBe(true);
    expect(pathForOnboardingPhase("saldo")).toBe(ONBOARDING_SALDO_PATH);
  });

  it("never repeats the blocking flow once saldo exists", () => {
    expect(
      resolveOnboardingPhase({
        ...empty,
        onboardingSaldoAt: "2026-08-27T12:00:00.000Z",
      }),
    ).toBe("done");
    expect(
      resolveOnboardingPhase({
        ...empty,
        onboardingCompletedAt: "2026-08-27T12:05:00.000Z",
        hasAccounts: true,
        hasSaldo: true,
      }),
    ).toBe("done");
    expect(pathForOnboardingPhase("done")).toBe(HOME_PATH);
  });

  it("skips Hugo even with an empty ledger", () => {
    expect(
      resolveOnboardingPhase({ ...empty, email: "Qualityltf@gmail.com" }),
    ).toBe("done");
    expect(
      resolveOnboardingPhase({ ...empty, email: "QualityLTF@gmail.com" }),
    ).toBe("done");
  });

  it("skips anyone who already has accounts or saldo", () => {
    expect(resolveOnboardingPhase({ ...empty, hasAccounts: true })).toBe(
      "done",
    );
    expect(resolveOnboardingPhase({ ...empty, hasSaldo: true })).toBe("done");
  });
});

describe("isOnboardingPath", () => {
  it("matches the guided flow only", () => {
    expect(isOnboardingPath("/kom-igang")).toBe(true);
    expect(isOnboardingPath("/kom-igang/fota")).toBe(true);
    expect(isOnboardingPath(ONBOARDING_PLAN_PATH)).toBe(true);
    expect(isOnboardingPath("/idag")).toBe(false);
    expect(isOnboardingPath("/fota")).toBe(false);
  });
});
