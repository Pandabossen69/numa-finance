import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/installningar/ny-anvandare", () => {
  it("is admin-gated with a 404 for everyone else", () => {
    expect(page).toContain("requireNumaAdminOrNotFound");
    expect(page).toContain("Ny användare");
    expect(page).toContain("CreateUserForm");
    expect(page).toContain("max-w-lg");
    expect(page).toContain("numa-panel-strong");
    expect(page).not.toContain("user_metadata");
  });
});
