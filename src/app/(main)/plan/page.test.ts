import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/plan getting-started hints", () => {
  it("opens the matching add form and keeps one spoken Swedish hint", () => {
    expect(page).toContain("steg === \"inkomst\"");
    expect(page).toContain("steg === \"utgift\"");
    expect(page).toContain("Här lägger du in det som kommer in.");
    expect(page).toContain("Här lägger du in det som måste betalas.");
    expect(page).toContain("Vad som kommer in och vad som måste ut.");
    expect(page).toContain("focusAdd={focusAdd}");
    expect(page).toContain("stepHint={hint}");
    expect(page).not.toMatch(/välkommen/i);
  });
});
