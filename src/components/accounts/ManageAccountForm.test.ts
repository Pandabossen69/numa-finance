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

  it("offers Ta bort konto on every active account, confirmed before the write", () => {
    expect(src).toContain("removeAccountAction");
    expect(src).toContain("Ta bort konto");
    expect(src).toContain('{pending ? "Tar bort…" : "Ta bort"}');
    expect(src).toContain("Avbryt");
    expect(src).toContain("adoptRemovedAccount");
    expect(src).toContain("confirmRemove");
    expect(src).not.toContain("Radera konto");
    expect(src).not.toContain("Arkivera konto");
    const confirm = src.slice(src.indexOf("confirmRemove ? ("));
    expect(confirm).toContain("onRemove");
    expect(confirm).toContain("setConfirmRemove(false)");
  });

  it("explains archive when history exists and hard delete when the account is empty", () => {
    expect(src).toContain("Rörelserna finns kvar");
    expect(src).toContain("Arkiverade");
    expect(src).toContain("Det går inte att ångra");
    expect(src).toContain("account.hasLedgerHistory");
    expect(src).toContain("Du kan lägga till ett nytt konto efteråt.");
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
