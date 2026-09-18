import { describe, expect, it } from "vitest";
import { LOAD_TIMEOUT_MESSAGE_SV } from "@/lib/async";
import {
  ANALYS_CLIENT_TIMEOUT_MS,
  fetchAnalysSnapshotClient,
} from "./analys-client-fetch";

describe("fetchAnalysSnapshotClient", () => {
  it("fails soft in Swedish when the action never settles", async () => {
    expect(ANALYS_CLIENT_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
    const result = await fetchAnalysSnapshotClient(
      () => new Promise(() => {}),
      20,
    );
    expect(result).toEqual({
      ok: false,
      error: LOAD_TIMEOUT_MESSAGE_SV,
    });
  });

  it("passes through a settled snapshot", async () => {
    const result = await fetchAnalysSnapshotClient(async () => ({
      ok: true,
      data: { monthKey: "2026-09" } as never,
    }));
    expect(result.ok).toBe(true);
  });

  it("keeps a Swedish loader error without wrapping it", async () => {
    const result = await fetchAnalysSnapshotClient(async () => ({
      ok: false,
      error: "Du måste vara inloggad",
    }));
    expect(result).toEqual({ ok: false, error: "Du måste vara inloggad" });
  });
});
