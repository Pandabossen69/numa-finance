/**
 * Bangkok Bank "Payment confirmation" email parser.
 *
 * Unlike the SMS format (bank-parsers.ts), these emails are sent by
 * Bualuang mBanking for card/QR/PromptPay-style payments and carry a real
 * payee name — something the SMS notifications never include. They are
 * plain structured text (Thai block, then an English block with the same
 * fields), so this is label:value parsing, not OCR/vision guessing.
 *
 * Two things the SMS format also never gives us, which this format does:
 *  - a payee/merchant name (sometimes a real shop, sometimes an e-wallet
 *    top-up service — see isWalletTopUp below)
 *  - a bank-assigned reference number, a far more reliable de-dupe key
 *    than the balance-after trick the SMS parser has to use
 *
 * What it does NOT give us: a running account balance. So this can update
 * Rörelser (the ledger) but must never be treated as a Hem/saldo source —
 * that stays SMS/bank-app territory.
 */

import { zonedWallTimeToUtcIso } from "@/domain/finance/datetime";
import { westernAmountToMinor } from "@/domain/imports/ocr-amounts";

export type ParsedBankMailPayment = {
  institution: "Bangkok Bank";
  /** "Service code / Payee ID" — e.g. TMNINAPP, or a merchant terminal id. */
  payeeCode: string | null;
  /** "Service name / Payee name" — cleaned up, e.g. "MCD-00179HUA-HIN MARKET V". */
  merchant: string | null;
  /** Last 4 digits from "Account no. / credit card no.". */
  maskedAccount: string | null;
  amountMinor: number | null;
  currency: "THB";
  referenceNo1: string | null;
  referenceNo2: string | null;
  /** The bank's own short reference number — best available de-dupe key. */
  referenceNo: string | null;
  /** UTC ISO, converted from the mail's Thailand wall-clock timestamp. */
  occurredAt: string | null;
  /**
   * True when the payee looks like an e-wallet top-up/provider (TrueMoney,
   * Rabbit LINE Pay, ShopeePay, …) rather than an actual shop — the money
   * left the bank account, but what it was actually spent on is still
   * unknown, so this should not get an auto-guessed spending category.
   */
  isWalletTopUp: boolean;
  raw: string;
};

/** Company names that are payment rails / e-wallets, not the real merchant. */
const WALLET_PROVIDER_PATTERNS = [
  /true\s*money/i,
  /rabbit\s*(line\s*pay)?/i,
  /shopee\s*pay/i,
  /line\s*pay/i,
  /air\s*pay/i,
  /wechat\s*pay/i,
  /alipay/i,
];

function looksLikeWalletTopUp(payeeCode: string | null, merchant: string | null): boolean {
  if (payeeCode && /^TMN/i.test(payeeCode.trim())) return true;
  if (!merchant) return false;
  return WALLET_PROVIDER_PATTERNS.some((re) => re.test(merchant));
}

/** English label → value, tolerant of the tabs/extra spaces email clients leave in. */
function matchLabel(text: string, label: string): string | null {
  const re = new RegExp(
    `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\t?\\s*(.+)`,
    "i",
  );
  const m = text.match(re);
  return m ? m[1]!.trim() : null;
}

const ENGLISH_MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/** "15 March 2026 at 09:15:42" → "2026-03-15T09:15:42" (Bangkok wall time). */
function parseEnglishDateTime(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+at\s+(\d{2}):(\d{2}):(\d{2})/,
  );
  if (!m) return null;
  const month = ENGLISH_MONTHS[m[2]!.toLowerCase()];
  if (!month) return null;
  const day = m[1]!.padStart(2, "0");
  return `${m[3]}-${month}-${day}T${m[4]}:${m[5]}:${m[6]}`;
}

function lastDigits(value: string | null, count = 4): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return digits.slice(-count).padStart(Math.min(count, digits.length), "0");
}

/** Only the standalone "Reference no." line — not "Reference no. 1" / "2". */
function matchFinalReferenceNo(text: string): string | null {
  const m = text.match(/Reference no\.(?!\s*[12])\s*\t?\s*([A-Za-z0-9]+)/i);
  return m ? m[1]!.trim() : null;
}

export function looksLikeBangkokBankMail(text: string): boolean {
  const t = text.toLowerCase();
  const hasStructure = t.includes("payee name") || t.includes("amount (baht)");
  const hasConfirmation =
    t.includes("payment confirmation") ||
    (t.includes("bangkok bank") && t.includes("reference no"));
  return hasStructure && hasConfirmation;
}

/**
 * Parse one Bangkok Bank "ยืนยันการชำระเงิน / Payment confirmation" email.
 * Returns null when the mail doesn't look like this format at all — callers
 * should fall back to the SMS/bank-app parsers rather than guessing.
 */
export function parseBankMailPayment(text: string): ParsedBankMailPayment | null {
  if (!looksLikeBangkokBankMail(text)) return null;

  // matchLabel escapes regex-special characters itself — pass plain text
  // here, not pre-escaped, or the label match silently fails (double escaping).
  const merchant = matchLabel(text, "Service name / Payee name");
  const payeeCode = matchLabel(text, "Service code / Payee ID");
  const account = matchLabel(text, "Account no. / credit card no.");
  const referenceNo1 = matchLabel(text, "Reference no. 1");
  const referenceNo2 = matchLabel(text, "Reference no. 2");
  const referenceNo = matchFinalReferenceNo(text);
  const amountRaw = matchLabel(text, "Amount (Baht)");
  const dateRaw = matchLabel(text, "Date");

  let amountMinor: number | null = null;
  if (amountRaw) {
    try {
      amountMinor = westernAmountToMinor(amountRaw);
    } catch {
      amountMinor = null;
    }
  }
  const wallLocal = parseEnglishDateTime(dateRaw);

  return {
    institution: "Bangkok Bank",
    payeeCode: payeeCode || null,
    merchant: merchant || null,
    maskedAccount: lastDigits(account),
    amountMinor,
    currency: "THB",
    referenceNo1: referenceNo1 || null,
    referenceNo2: referenceNo2 || null,
    referenceNo: referenceNo || null,
    occurredAt: wallLocal ? zonedWallTimeToUtcIso(wallLocal, "Asia/Bangkok") : null,
    isWalletTopUp: looksLikeWalletTopUp(payeeCode, merchant),
    raw: text.trim(),
  };
}
