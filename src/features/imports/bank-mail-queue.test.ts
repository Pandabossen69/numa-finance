import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIngestHeaders } from "../../../scripts/post-bank-mail.mjs";
import {
  bankMailConfirmHeading,
  splitImporteraRows,
} from "@/features/imports/bank-mail-queue";
import {
  lastImporteraRows,
  patchImporteraRow,
  rememberImporteraRows,
  resetImporteraHandledForTests,
  subscribeImporteraRows,
} from "@/features/home/last-snapshot";

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
    expect(hem).toContain("count <= 0");
    expect(screen).toContain("Avvisa");
    expect(screen).toContain("text-[var(--numa-danger)]");
    const fota = readFileSync(
      new URL("../../components/capture/FotaScreen.tsx", import.meta.url),
      "utf8",
    );
    expect(fota).toContain('key={observationId ?? "bank-mail"}');
    const confirm = readFileSync(
      new URL("../../components/capture/BankMailConfirm.tsx", import.meta.url),
      "utf8",
    );
    expect(confirm).toContain("Avvisa");
    expect(confirm).toContain("text-[var(--numa-danger)]");
    expect(confirm).toContain("refreshAfterBankMailQueueChange");
    expect(confirm).toContain("bankMailConfirmBlockedMessage");
    expect(confirm).not.toContain("await refreshAfterBankMailQueueChange");
    const ack = confirm.indexOf("publishBankMailSavedToast");
    const homeJump = confirm.indexOf("goHomeInstant(router)");
    const background = confirm.indexOf("void refreshAfterBankMailQueueChange");
    expect(ack).toBeGreaterThan(0);
    expect(ack).toBeLessThan(homeJump);
    expect(homeJump).toBeLessThan(background);
    const rejectHop = confirm.indexOf("goImporteraInstant(router)");
    const rejectAck = confirm.lastIndexOf("flushSync", rejectHop);
    expect(rejectAck).toBeGreaterThan(ack);
    expect(rejectAck).toBeLessThan(rejectHop);
    expect(confirm).toContain("blocked ? null");
    const refresh = readFileSync(
      new URL("./bank-mail-queue-refresh.ts", import.meta.url),
      "utf8",
    );
    expect(refresh).toContain("invalidateSettledHomeSurfaces");
    expect(refresh).toContain("adoptMutationFinance");
    expect(refresh).toContain("refreshBankMailSurfacesAction");
    const actions = readFileSync(
      new URL("./bank-mail-actions.ts", import.meta.url),
      "utf8",
    );
    expect(actions).not.toMatch(/revalidatePath\s*\(/);
    expect(actions).toContain('revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max")');
    expect(screen).toContain("deleteObservationAction");
    expect(screen).toContain('aria-label="Radera bilden"');
    expect(screen).toContain('o.status === "uploaded"');
    expect(refresh).toContain("console.error");
    expect(refresh).toContain("retryBankMailSurfacesIfStale");
    const shell = readFileSync(
      new URL("../../components/layout/AppShell.tsx", import.meta.url),
      "utf8",
    );
    const toast = readFileSync(
      new URL("../../components/home/BankMailSavedToast.tsx", import.meta.url),
      "utf8",
    );
    expect(shell).toContain("<BankMailSavedToast />");
    expect(toast).toContain("createPortal");
    expect(toast).toContain("z-[100]");
    expect(toast).toContain("useSyncExternalStore");
    expect(toast).toContain("retryBankMailSurfacesIfStale");
    expect(hem).not.toContain("createPortal");
    expect(hem).not.toContain("bankMailToastSnapshot");
  });

  it("does not let an older cached list revive a handled mail", () => {
    resetImporteraHandledForTests();
    const row = (
      id: string,
      status: "needs_review" | "processed",
      notes: string | null,
    ) => ({
      id,
      kind: "bank_mail",
      status,
      createdAt: "2026-10-03T00:00:00.000Z",
      notes,
    });
    rememberImporteraRows([
      row("mail-1", "needs_review", "Nav"),
      row("mail-2", "needs_review", "Kvar"),
    ]);
    patchImporteraRow("mail-1", { status: "processed", notes: "Avvisad" });
    rememberImporteraRows([
      row("mail-1", "needs_review", "Nav"),
      row("mail-2", "needs_review", "Kvar"),
    ]);
    const rows = lastImporteraRows();
    expect(rows?.find((item) => item.id === "mail-1")).toMatchObject({
      status: "processed",
      notes: "Avvisad",
    });
    expect(splitImporteraRows(rows ?? []).pendingMail.map((item) => item.id)).toEqual([
      "mail-2",
    ]);
    expect(bankMailConfirmHeading(1)).toBe("Att bekräfta (1)");
    resetImporteraHandledForTests();
  });

  it("updates a mounted queue row without a new server payload", () => {
    resetImporteraHandledForTests();
    rememberImporteraRows([
      {
        id: "mail-1",
        kind: "bank_mail",
        status: "needs_review",
        createdAt: "2026-10-03T00:00:00.000Z",
        notes: null,
      },
    ]);
    let hits = 0;
    const stop = subscribeImporteraRows(() => {
      hits += 1;
    });
    patchImporteraRow("mail-1", { status: "processed", notes: "Avvisad" });
    expect(hits).toBe(1);
    expect(lastImporteraRows()?.[0]).toMatchObject({
      status: "processed",
      notes: "Avvisad",
    });
    stop();
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
