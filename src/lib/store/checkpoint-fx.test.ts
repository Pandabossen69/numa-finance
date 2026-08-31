import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/domain/money/fx", () => ({
  fetchFxToThb: vi.fn(async () => null),
  thbMinorFromNative: (minor: number, _currency: string, rate: number) =>
    Math.round(minor * rate),
}));

import { resolveCheckpointFx } from "./checkpoint-fx";

describe("resolveCheckpointFx", () => {
  it("throws when a non-THB rate cannot be fetched", async () => {
    await expect(
      resolveCheckpointFx({ currency: "EUR", balanceMinor: 100_00 }),
    ).rejects.toThrow(/växelkurs/);
  });

  it("returns null on bootstrap when requireFx is off", async () => {
    await expect(
      resolveCheckpointFx({
        currency: "EUR",
        balanceMinor: 0,
        required: false,
      }),
    ).resolves.toBeNull();
  });

  it("lets the first bank-app EUR import bootstrap without Frankfurter", () => {
    const supabase = readFileSync(
      new URL("./supabase-repository.ts", import.meta.url),
      "utf8",
    );
    const local = readFileSync(
      new URL("./local-repository.ts", import.meta.url),
      "utf8",
    );
    expect(supabase).toContain("requireFx: false");
    expect(local).toContain("requireFx: false");
    expect(supabase).toContain("kind: wantedCurrency === \"THB\" ? \"thai_bank\" : \"other\"");
    expect(local).toContain("kind: wantedCurrency === \"THB\" ? \"thai_bank\" : \"other\"");
  });

  it("locks THB as identity", async () => {
    const lock = await resolveCheckpointFx({
      currency: "THB",
      balanceMinor: 50_00,
    });
    expect(lock).toMatchObject({
      thbMinor: 50_00,
      fxRate: 1,
      fxSource: "identity",
    });
  });
});
