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

  it("deletes empty zero-saldo accounts only after confirmation", () => {
    expect(src).toContain("deleteAccountAction");
    expect(src).toContain("Radera konto");
    expect(src).toContain("Ja, radera konto");
    expect(src).toContain("balanceMinor: account.calculatedMinor");
    expect(src).toContain("saldot är 0");
  });

  it("always shows archive or delete, disabled when blocked", () => {
    expect(src).toContain("explainAccountRetireUi");
    expect(src).toContain("retire.blocked");
    expect(src).toContain("MAKE_OTHER_DEFAULT_HINT_SV");
    expect(src).toContain("onMakeSiblingDefault");
    expect(src).toContain("Gör {sibling.name} förvalt");
    expect(src).toContain("Radera konto");
    expect(src).toContain("Arkivera konto");
  });

  it("does not hide the retire button just because the account is default", () => {
    expect(src).not.toContain("{account.isDefault ? (");
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
