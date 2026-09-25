import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bankMailAccountLabel } from "@/features/imports/bank-mail-label";
import { buildCapturePreview } from "@/features/imports/capture-preview";
import {
  fotaHrefForObservation,
  modeForObservation,
  parseFotaMode,
} from "@/features/imports/capture-resume";
import type { ExtractedTransactionCandidate } from "@/domain/finance";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OBS = "11111111-1111-4111-8111-111111111111";

describe("bank mail stays out of the screenshot writer", () => {
  it("never inserts a transaction from ingest", () => {
    const store = readFileSync(new URL("./bank-mail-store.ts", import.meta.url), "utf8");
    const ingest = readFileSync(new URL("./bank-mail-ingest.ts", import.meta.url), "utf8");
    const route = readFileSync(
      new URL("../../app/api/import/bank-mail/route.ts", import.meta.url),
      "utf8",
    );
    expect(store).not.toMatch(/from\(["']transactions["']\)/);
    expect(ingest).not.toMatch(/from\(["']transactions["']\)/);
    expect(route).toContain("createSupabaseServiceRoleClient");
    expect(route).toContain("handleBankMailPost");
    expect(store).toContain('status: "needs_review"');
    expect(store).toContain("source_observations");
    expect(store).toContain("extraction_runs");
    expect(store).toContain("extracted_transaction_candidates");
  });

  it("confirm writes a ledger row and no saldo checkpoint", () => {
    const confirm = readFileSync(new URL("./bank-mail-confirm.ts", import.meta.url), "utf8");
    expect(confirm).toContain('from("transactions")');
    expect(confirm).not.toContain("balance_checkpoints");
    expect(confirm).not.toContain("createCheckpoint");
    expect(confirm).toContain('kind !== BANK_MAIL_OBSERVATION_KIND');
  });

  it("does not change the Fota screenshot component", () => {
    const flow = readFileSync(
      new URL("../../components/capture/ReceiptCaptureFlow.tsx", import.meta.url),
      "utf8",
    );
    expect(flow).not.toContain("Bangkok Bank-mejl");
    expect(flow).not.toContain("bank_mail");
    expect(flow).not.toContain("confirmBankMailAction");
  });
});

describe("bank mail account label", () => {
  it("keeps the account chosen at ingest when Hem still says Konto", () => {
    expect(
      bankMailAccountLabel({ liveName: "Konto", storedName: "Bangkok Bank" }),
    ).toBe("Bangkok Bank");
    expect(
      bankMailAccountLabel({ liveName: "Sparkonto", storedName: "Bangkok Bank" }),
    ).toBe("Sparkonto");
  });
});

describe("confirmation queue label", () => {
  it("resumes a bank mail into the same Fota confirm entry with the mail source", () => {
    expect(parseFotaMode("bank_mail")).toBe("bank_mail");
    expect(parseFotaMode("sms")).toBe("bank_sms");
    expect(modeForObservation({ kind: "bank_mail" })).toBe("bank_mail");
    expect(modeForObservation({ kind: "screenshot" })).toBe("bank_sms");
    expect(
      fotaHrefForObservation({
        id: OBS,
        kind: "bank_mail",
        status: "needs_review",
      }),
    ).toBe(`/fota?mode=bank_mail&observation=${OBS}`);

    const candidate: ExtractedTransactionCandidate = {
      id: "cand-mail",
      extractionRunId: "run-mail",
      observationId: OBS,
      userId: USER,
      direction: "debit",
      amountMinor: 31250,
      currency: "THB",
      balanceAfterMinor: null,
      occurredAt: "2026-01-03T11:08:05+07:00",
      description: "MCD-00179HUA-HIN MARKET V",
      confidence: 0.99,
      fingerprint: "bbl-mail:ref:200002",
      status: "needs_review",
      canonicalTransactionId: null,
      rawPayload: {
        importKind: "bank_mail",
        sourceLabel: "Bangkok Bank-mejl",
        counterparty: "MCD-00179HUA-HIN MARKET V",
        accountId: ACCOUNT,
        accountName: "Bangkok Bank",
        isWalletTopUp: false,
      },
      createdAt: "2026-01-03T04:08:05.000Z",
      updatedAt: "2026-01-03T04:08:05.000Z",
    };

    const preview = buildCapturePreview({
      observation: {
        id: OBS,
        kind: "bank_mail",
        institutionHint: "Bangkok Bank",
        status: "needs_review",
        notes: "MCD-00179HUA-HIN MARKET V",
      },
      candidates: [candidate],
      previewUrl: null,
      fallbackCurrency: "THB",
      openingBalanceAt: "2026-08-01T00:00:00.000Z",
    });

    expect(preview?.importKind).toBe("bank_mail");
    expect(preview?.openingBalanceAt).toBe("2026-08-01T00:00:00.000Z");
    expect(preview?.sourceLabel).toBe("Bangkok Bank-mejl");
    expect(preview?.preselectedAccountId).toBe(ACCOUNT);
    expect(preview?.accountName).toBe("Bangkok Bank");
    expect(preview?.description).toBe("MCD-00179HUA-HIN MARKET V");
    expect(preview?.occurredAt).toBe("2026-01-03T11:08:05+07:00");
    expect(preview?.events[0]?.amountMinor).toBe(31250);
    expect(preview?.alreadyKnown).toBe(false);

    expect(
      buildCapturePreview({
        observation: {
          id: OBS,
          kind: "screenshot",
          institutionHint: "Bangkok Bank",
          status: "needs_review",
          notes: null,
        },
        candidates: [candidate],
        previewUrl: null,
        fallbackCurrency: "THB",
      }),
    ).toBeNull();
  });
});

describe("post-bank-mail script", () => {
  it("reads an .eml into route fields without posting", () => {
    const output = execFileSync(
      process.execPath,
      [
        "scripts/post-bank-mail.mjs",
        "--dry-run",
        "--file",
        "scripts/fixtures/bangkok-card-payment.eml",
        "--user-id",
        USER,
        "--account-id",
        ACCOUNT,
      ],
      { encoding: "utf8" },
    );
    const payload = JSON.parse(output) as {
      messageId: string;
      subject: string;
      body: string;
      userId: string;
      accountId: string;
    };
    expect(payload.userId).toBe(USER);
    expect(payload.accountId).toBe(ACCOUNT);
    expect(payload.messageId).toBe("<anon-card-200002@bank.example>");
    expect(payload.subject).toBe("Payment confirmation");
    expect(payload.body).toContain("MCD-00179HUA-HIN MARKET V");
    expect(payload.body).toContain("Amount (Baht)");
    expect(output).not.toContain("BANK_MAIL_INGEST_TOKEN");
  });
});
