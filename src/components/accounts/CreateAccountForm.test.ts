import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./CreateAccountForm.tsx", import.meta.url),
  "utf8",
);

describe("CreateAccountForm", () => {
  it("starts from kind defaults, not Bangkok Bank / 6591", () => {
    expect(src).toContain("defaultNameForKind(initialKind)");
    expect(src).toContain("defaultCurrencyForKind(initialKind)");
    expect(src).not.toMatch(/name:\s*"Bangkok Bank"/);
    expect(src).not.toMatch(/maskedIdentifier:\s*"6591"/);
  });

  it("defaults currency from the account kind, not a hardcoded SEK", () => {
    expect(src).toContain("primaryCurrency");
    expect(src).toContain("defaultCurrencyForKind");
    expect(src).not.toMatch(/currency:\s*"SEK"/);
  });

  it("labels the default-account checkbox as suggested for new expenses", () => {
    expect(src).toContain("DEFAULT_ACCOUNT_COPY_SV");
    expect(src).toContain("DEFAULT_ACCOUNT_HELP_SV");
    expect(src).not.toContain("Primärt konto för utgifter (Hem)");
    expect(src).not.toContain("Använd på Idag");
  });

  it("asks for kind + name + currency + amount, not institution", () => {
    expect(src).toContain("Typ av konto");
    expect(src).toContain("Hur mycket har du just nu?");
    expect(src).not.toContain("Var pengarna finns");
    expect(src).not.toMatch(/institution:\s*form/);
  });
});
