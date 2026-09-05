import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./ManageAccountForm.tsx", import.meta.url), "utf8");

describe("ManageAccountForm", () => {
  it("lets the owner edit name and kind, and explains the effect", () => {
    expect(src).toContain("updateAccountAction");
    expect(src).toContain("Typ av konto");
    expect(src).toContain("Namn");
    expect(src).toContain("Typen styr vilka valutor som går");
    expect(src).toContain("Namnet syns i listor");
  });

  it("locks currency when the account has history", () => {
    expect(src).toContain("currencyLocked");
    expect(src).toContain("CURRENCY_LOCKED_SV");
    expect(src).toContain("account.hasLedgerHistory");
  });

  it("deletes empty accounts only after confirmation", () => {
    expect(src).toContain("deleteAccountAction");
    expect(src).toContain("Radera konto");
    expect(src).toContain("Ja, radera konto");
    expect(src).toContain("Det går inte att ångra");
  });

  it("offers archive — not hard delete — when history exists", () => {
    expect(src).toContain("archiveAccountAction");
    expect(src).toContain("Arkivera konto");
    expect(src).toContain("Ja, arkivera konto");
    expect(src).toContain("Saldo måste vara 0");
    expect(src).toContain("Konton med historik kan inte raderas");
  });

  it("restores archived accounts", () => {
    expect(src).toContain("restoreAccountAction");
    expect(src).toContain("Återställ konto");
    expect(src).toContain("är arkiverat");
  });

  it("reuses the default-account copy", () => {
    expect(src).toContain("DEFAULT_ACCOUNT_COPY_SV");
    expect(src).toContain("DEFAULT_ACCOUNT_HELP_SV");
    expect(src).not.toContain("Primärt konto för utgifter (Hem)");
  });
});
