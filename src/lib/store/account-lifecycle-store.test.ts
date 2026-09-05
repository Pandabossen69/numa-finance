import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const local = readFileSync(new URL("./local-repository.ts", import.meta.url), "utf8");
const remote = readFileSync(
  new URL("./supabase-repository.ts", import.meta.url),
  "utf8",
);

describe("account management ownership", () => {
  it("scopes supabase get/update/delete/archive/restore to the signed-in user", () => {
    expect(remote).toContain("export async function updateAccount");
    expect(remote).toContain("export async function deleteAccount");
    expect(remote).toContain("export async function archiveAccount");
    expect(remote).toContain("export async function restoreAccount");
    expect(remote).toContain("export const listArchivedAccounts");

    const update = remote.slice(
      remote.indexOf("export async function updateAccount"),
      remote.indexOf("export async function deleteAccount"),
    );
    expect(update).toContain('const account = await getAccount(input.id)');
    expect(update).toContain('.eq("user_id", userId)');
    expect(update).toContain('.eq("id", input.id)');

    const del = remote.slice(
      remote.indexOf("export async function deleteAccount"),
      remote.indexOf("export async function archiveAccount"),
    );
    expect(del).toContain("const account = await getAccount(id)");
    expect(del).toContain("evaluateDeleteAccount");
    expect(del).toContain('.eq("user_id", userId)');
    expect(del).toContain('.eq("id", id)');

    const archive = remote.slice(
      remote.indexOf("export async function archiveAccount"),
      remote.indexOf("export async function restoreAccount"),
    );
    expect(archive).toContain("evaluateArchiveAccount");
    expect(archive).toContain('.eq("user_id", userId)');
    expect(archive).toContain("is_active: false");

    const restore = remote.slice(
      remote.indexOf("export async function restoreAccount"),
      remote.indexOf("export async function ensureDefaultBankAccount"),
    );
    expect(restore).toContain("evaluateRestoreAccount");
    expect(restore).toContain("is_active: true");
    expect(restore).toContain('.eq("user_id", userId)');

    const get = remote.slice(
      remote.indexOf("export async function getAccount"),
      remote.indexOf("export const listArchivedAccounts"),
    );
    expect(get).toContain('.eq("user_id", userId)');
    expect(get).toContain('.eq("id", accountId)');
  });

  it("evaluates lifecycle rules before local delete/archive/restore", () => {
    expect(local).toContain("evaluateDeleteAccount");
    expect(local).toContain("evaluateArchiveAccount");
    expect(local).toContain("evaluateRestoreAccount");
    expect(local).toContain("listArchivedAccounts");
    expect(local).toContain("assertAccountAcceptsWrites");
  });

  it("hides archived accounts from the active list used by new transactions", () => {
    expect(remote).toContain('.eq("is_active", true)');
    expect(remote).toContain('.eq("is_active", false)');
    expect(local).toContain("store.accounts.filter((a) => a.isActive)");
    expect(local).toContain("store.accounts.filter((a) => !a.isActive)");
  });
});
