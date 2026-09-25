import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIngestHeaders } from "../../../scripts/post-bank-mail.mjs";
import {
  bankMailConfirmHeading,
  splitImporteraRows,
} from "@/features/imports/bank-mail-queue";

describe("importera mail section", () => {
  it("counts only pending bank mail and leaves screenshots in the picture list", () => {
    const split = splitImporteraRows([
      { id: "mail-1", kind: "bank_mail", status: "needs_review" },
      { id: "shot", kind: "screenshot", status: "needs_review" },
      { id: "mail-saved", kind: "bank_mail", status: "processed" },
      { id: "mail-2", kind: "bank_mail", status: "needs_review" },
    ]);
    expect(split.pendingMail.map((row) => row.id)).toEqual(["mail-1", "mail-2"]);
    expect(bankMailConfirmHeading(split.pendingMail.length)).toBe(
      "Att bekräfta (2)",
    );
    expect(split.rest.map((row) => row.id)).toEqual(["shot", "mail-saved"]);
  });

  it("hides the heading count when nothing is waiting", () => {
    const split = splitImporteraRows([
      { id: "shot", kind: "screenshot", status: "processed" },
    ]);
    expect(split.pendingMail).toHaveLength(0);
    expect(bankMailConfirmHeading(0)).toBe("Att bekräfta (0)");
  });

  it("wires the heading on Importera and the Hem link", () => {
    const screen = readFileSync(
      new URL("../../components/mer/ImporteraScreen.tsx", import.meta.url),
      "utf8",
    );
    const hem = readFileSync(
      new URL("../../components/home/BankMailHemCue.tsx", import.meta.url),
      "utf8",
    );
    expect(screen).toContain("bankMailConfirmHeading(pendingMail.length)");
    expect(screen).toContain('id="att-bekrafta"');
    expect(hem).toContain('"/importera#att-bekrafta"');
    expect(hem).toContain("count > 0");
  });
});

describe("preview protection bypass header", () => {
  it("sends the header only when the env secret is set", () => {
    const plain = buildIngestHeaders({
      BANK_MAIL_INGEST_TOKEN: "local-token",
    });
    expect(plain.Authorization).toBe("Bearer local-token");
    expect(plain["x-vercel-protection-bypass"]).toBeUndefined();

    const bypass = buildIngestHeaders({
      BANK_MAIL_INGEST_TOKEN: "local-token",
      VERCEL_AUTOMATION_BYPASS_SECRET: " bypass-secret ",
    });
    expect(bypass["x-vercel-protection-bypass"]).toBe("bypass-secret");
    expect(JSON.stringify(buildIngestHeaders.toString())).not.toContain(
      "bypass-secret",
    );
  });
});
