#!/usr/bin/env node
/**
 * Post one Bangkok Bank .eml or .txt into POST /api/import/bank-mail.
 *
 *   BANK_MAIL_INGEST_TOKEN=... node scripts/post-bank-mail.mjs \
 *     --file scripts/fixtures/bangkok-card-payment.eml \
 *     --user-id <uuid> \
 *     --account-id <uuid> \
 *     --url http://127.0.0.1:3000/api/import/bank-mail
 *
 * --dry-run prints the JSON body and does not send it.
 * The token is read from BANK_MAIL_INGEST_TOKEN and is never printed.
 * When VERCEL_AUTOMATION_BYPASS_SECRET is set, the request also sends
 * x-vercel-protection-bypass. The secret is never printed or hardcoded.
 */

import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

function usage() {
  console.error(`Användning:
  BANK_MAIL_INGEST_TOKEN=... node scripts/post-bank-mail.mjs \\
    --file <mejl.eml|mejl.txt> \\
    --user-id <uuid> \\
    --account-id <uuid> \\
    --url <https://.../api/import/bank-mail>

Flaggor:
  --file         .eml eller .txt (krävs)
  --user-id      användaren mejlet ska köas för (krävs)
  --account-id   kontot som redan är valt (krävs)
  --url          full URL till routen (krävs, ingen förvald adress)
  --message-id   om filen saknar Message-ID
  --dry-run      skriv JSON, posta inte

Miljö:
  BANK_MAIL_INGEST_TOKEN              krävs vid post
  VERCEL_AUTOMATION_BYPASS_SECRET     valfri, skickas som x-vercel-protection-bypass`);
}

function readArg(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function unfold(headers) {
  return headers.replace(/\r?\n[ \t]+/g, " ");
}

/** @param {{ BANK_MAIL_INGEST_TOKEN?: string, VERCEL_AUTOMATION_BYPASS_SECRET?: string }} env @returns {Record<string, string>} */
export function buildIngestHeaders(env) {
  const token = env.BANK_MAIL_INGEST_TOKEN?.trim() ?? "";
  /** @type {Record<string, string>} */
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  return headers;
}

export function parseMailFile(text, filename, messageIdFlag) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const ext = extname(filename).toLowerCase();
  const splitAt = normalized.search(/\n\n/);
  const looksLikeHeaders =
    splitAt > 0 && /^[A-Za-z-]+:\s/m.test(normalized.slice(0, splitAt));
  const parseHeaders = ext === ".eml" || looksLikeHeaders;

  if (!parseHeaders) {
    return {
      subject: "",
      from: "",
      date: "",
      messageId: messageIdFlag?.trim() || "",
      body: normalized.trim(),
    };
  }

  const rawHeaders = unfold(normalized.slice(0, splitAt));
  const body = normalized.slice(splitAt + 2).trim();
  const header = (name) => {
    const match = rawHeaders.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
    return match ? match[1].trim() : "";
  };
  return {
    subject: header("Subject"),
    from: header("From"),
    date: header("Date"),
    messageId: messageIdFlag?.trim() || header("Message-ID"),
    body,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(0);
  }

  const file = readArg(argv, "--file");
  const userId = readArg(argv, "--user-id");
  const accountId = readArg(argv, "--account-id");
  const url = readArg(argv, "--url");
  const messageIdFlag = readArg(argv, "--message-id");
  const dryRun = argv.includes("--dry-run");

  if (!file || !userId || !accountId || (!url && !dryRun)) {
    usage();
    process.exit(1);
  }

  const text = readFileSync(file, "utf8");
  const mail = parseMailFile(text, basename(file), messageIdFlag);
  const payload = {
    userId,
    accountId,
    subject: mail.subject,
    from: mail.from,
    date: mail.date,
    body: mail.body,
    messageId: mail.messageId,
  };

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const token = process.env.BANK_MAIL_INGEST_TOKEN?.trim();
  if (!token) {
    console.error("BANK_MAIL_INGEST_TOKEN saknas i miljön.");
    process.exit(1);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: buildIngestHeaders(process.env),
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  process.stdout.write(`${response.status} ${responseText}\n`);
  if (!response.ok) process.exit(1);
}

const isDirectRun = process.argv[1] && basename(process.argv[1]) === "post-bank-mail.mjs";
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "post-bank-mail failed");
    process.exit(1);
  });
}
