import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./analys-snapshot.ts", import.meta.url), "utf8");

describe("getAnalysSnapshotAction hang contract", () => {
  it("caps the server action so a hung snapshot cannot stall the client", () => {
    expect(src).toContain("ANALYS_ACTION_TIMEOUT_MS = 4_000");
    expect(src).toContain("withTimeout(");
    expect(src).toContain("loadAnalysSnapshot()");
    expect(src).toContain("unstable_rethrow");
    expect(src).toContain("LOAD_TIMEOUT_MESSAGE_SV");
    expect(src).toContain("loadErrorMessageSv");
  });
});
