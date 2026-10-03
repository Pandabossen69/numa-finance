import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { statusMeta } from "@/components/mer/ImporteraScreen";
import {
  MOVEMENT_REMOVED_LABEL,
  observationIdsWithRemovedMovement,
} from "./importera-removed";

describe("voided bank-mail status is derived at read time", () => {
  it("labels a movement removed only when every linked row is voided", () => {
    const removed = observationIdsWithRemovedMovement([
      { observationId: "mail-void", status: "voided" },
      { observationId: "mail-live", status: "confirmed" },
      { observationId: "mail-mixed", status: "voided" },
      { observationId: "mail-mixed", status: "confirmed" },
    ]);

    expect(removed.has("mail-void")).toBe(true);
    expect(removed.has("mail-live")).toBe(false);
    expect(removed.has("mail-mixed")).toBe(false);
    expect(observationIdsWithRemovedMovement([])).toEqual(new Set());
    expect(MOVEMENT_REMOVED_LABEL).toBe("Rörelsen borttagen");
    expect(statusMeta("processed", false, "Avvisad").label).toBe("Avvisad");
    expect(statusMeta("processed", false, "Bekräftad och sparad").label).toBe(
      "Sparad",
    );
    expect(statusMeta("uploaded", false, null).label).toBe("Mottagen");
  });

  it("shows the removed label in Importera without rewriting saved notes or dedupe", () => {
    const screen = readFileSync(
      new URL("../../components/mer/ImporteraScreen.tsx", import.meta.url),
      "utf8",
    );
    const page = readFileSync(
      new URL("./importera-rows-action.ts", import.meta.url),
      "utf8",
    );
    const confirm = readFileSync(new URL("./bank-mail-confirm.ts", import.meta.url), "utf8");
    const store = readFileSync(new URL("./bank-mail-store.ts", import.meta.url), "utf8");

    expect(screen).toContain("MOVEMENT_REMOVED_LABEL");
    expect(screen).toContain("movementRemoved");
    expect(page).toContain("listObservationMovementLinks");
    expect(page).toContain("institutionHint: observation.institutionHint");
    expect(page).not.toContain(".update(");
    expect(confirm).toContain('notes: "Bekräftad och sparad"');
    expect(store).toContain('.neq("status", "voided")');
  });
});
