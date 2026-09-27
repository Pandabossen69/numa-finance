/**
 * Bank-app amount and merchant cleanup.
 *
 * Clock times such as 05:30 / 11:30 parse as money (5,30 / 11,30) when ":" or
 * "." is read as a decimal separator. 11:02 does not, so that shot kept the
 * real THB amount. Candidates that sit inside a date/time are dropped here,
 * and a signed or currency-tagged amount wins over a bare number.
 */

import { tryEuropeanAmountToMinor } from "@/domain/imports/ocr-amounts";
import {
  parseCurrencyToken,
  type CurrencyCode,
} from "@/domain/money/currency";

const MONTH =
  "jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:s|ch)?|apr(?:il)?|maj|may|jun(?:i|e)?|jul(?:i|y)?|aug(?:usti|ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const WEEKDAY =
  "m[åa]n(?:dag)?|tis(?:dag)?|ons(?:dag)?|tors(?:dag)?|fre(?:dag)?|l[öo]r(?:dag)?|s[öo]n(?:dag)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?";

const DATE_CONTEXT = new RegExp(
  [
    `\\b(?:${MONTH})\\b`,
    `\\b(?:${WEEKDAY})\\b`,
    "\\bkl\\b",
    "\\b(?:idag|ig[åa]r|today|yesterday)\\b",
    "\\d{4}-\\d{2}-\\d{2}",
    "\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b",
  ].join("|"),
  "iu",
);

const LABEL =
  /\b(?:utgift|inkomst|belopp|total|summa|amount|att\s+betala)\b/iu;

const AMOUNT_RE =
  /([+\u2212−-])?\s*(?:(THB|SEK|EUR|USD|KR|BT|฿|€|\$)\s*)?((?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)[.,:]\d{2})(?!\d)\s*(THB|SEK|EUR|USD|KR|KRONOR|BT|฿|€|\$)?/giu;

const TYPE_WORD =
  /(?<![\p{L}\p{N}])(?:utgifter|utgift|inkomster|inkomst|ins[äa]ttningar|ins[äa]ttning|uttag|k[öo]p|betalningar|betalning|[öo]verf[öo]ringar|[öo]verf[öo]ring|expenses|expense|incomes|income|payments|payment|purchases|purchase|transfers|transfer|deposits|deposit|withdrawals|withdrawal)(?![\p{L}\p{N}])/giu;

const EDGE_PUNCT = /^[\s\u2212\-+\u00b7\u2022|·•]+|[\s\u2212\-+\u00b7\u2022|·•]+$/gu;

const HEADER_LINE =
  /^(?:kasikorn(?:\s+k\s*plus)?|k\s*plus|transaction details|transaktionsdetaljer|completed|failed|pending|godk[äa]nd|misslyckad|avbruten|details)$/iu;

export type BankAppAmountCandidate = {
  amountMinor: number;
  currency: CurrencyCode | null;
  signed: boolean;
  labeled: boolean;
  raw: string;
};

function lineHasDateContext(line: string): boolean {
  return DATE_CONTEXT.test(line);
}

function clockMinor(hours: number, minutes: number): number {
  return hours * 100 + minutes;
}

function parseAmountToken(raw: string): number | null {
  const normalized = raw.replace(":", ",");
  return tryEuropeanAmountToMinor(normalized);
}

function isClockToken(
  token: string,
  line: string,
  signed: boolean,
  currency: CurrencyCode | null,
): boolean {
  if (signed || currency) return false;
  const match = token.match(/^(\d{1,2})([:.])(\d{2})$/);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return false;
  if (match[2] === ":") return true;
  return lineHasDateContext(line);
}

function score(candidate: BankAppAmountCandidate): number {
  return (
    (candidate.currency ? 4 : 0) +
    (candidate.signed ? 2 : 0) +
    (candidate.labeled ? 2 : 0)
  );
}

export function textForBankAppAmount(input: {
  rawText?: string | null;
  occurredAt?: string | null;
  fullText?: string | null;
}): string {
  const local = [input.rawText, input.occurredAt]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
  const screen = input.fullText?.trim() ?? "";
  const localScan = collectBankAppAmountCandidates(local);
  const screenScan = screen
    ? collectBankAppAmountCandidates(screen)
    : { candidates: [], clockMinors: new Set<number>() };
  // A bare 5.30 copied from "05:30" must not hide the real amount on the screen.
  const clockMinors = new Set([
    ...localScan.clockMinors,
    ...screenScan.clockMinors,
  ]);
  const localAmounts = localScan.candidates.filter(
    (candidate) => !clockMinors.has(candidate.amountMinor),
  );
  if (localAmounts.length > 0) return local;

  if (!screen) return local;
  const screenAmounts = screenScan.candidates.filter(
    (candidate) => !screenScan.clockMinors.has(candidate.amountMinor),
  );
  const priced = screenAmounts.filter((candidate) => candidate.currency);
  if (priced.length === 1 || screenAmounts.length === 1) {
    return [local, screen].filter(Boolean).join("\n");
  }
  return local;
}

export function collectBankAppAmountCandidates(text: string): {
  candidates: BankAppAmountCandidate[];
  clockMinors: Set<number>;
} {
  AMOUNT_RE.lastIndex = 0;
  const candidates: BankAppAmountCandidate[] = [];
  const clockMinors = new Set<number>();
  const lines = text.replace(/\r/g, "\n").split("\n");

  for (const line of lines) {
    const labeled = LABEL.test(line);
    AMOUNT_RE.lastIndex = 0;
    for (const match of line.matchAll(AMOUNT_RE)) {
      const signed = Boolean(match[1]);
      const token = match[3] ?? "";
      const currency =
        parseCurrencyToken(match[4]) ?? parseCurrencyToken(match[2]);
      const clock = token.match(/^(\d{1,2})([:.])(\d{2})$/);
      if (clock && isClockToken(token, line, signed, currency)) {
        clockMinors.add(clockMinor(Number(clock[1]), Number(clock[3])));
        continue;
      }
      const amountMinor = parseAmountToken(token);
      if (amountMinor == null || amountMinor <= 0) continue;
      candidates.push({
        amountMinor,
        currency,
        signed,
        labeled,
        raw: match[0]!.trim(),
      });
    }
  }

  return { candidates, clockMinors };
}

function pickBest(
  candidates: BankAppAmountCandidate[],
): { candidate: BankAppAmountCandidate; tied: boolean } | null {
  if (candidates.length === 0) return null;
  let bestScore = -1;
  for (const candidate of candidates) {
    bestScore = Math.max(bestScore, score(candidate));
  }
  const top = candidates.filter((candidate) => score(candidate) === bestScore);
  const distinct = new Set(top.map((candidate) => candidate.amountMinor));
  return { candidate: top[0]!, tied: distinct.size > 1 };
}

/**
 * Keep a real vision amount. Replace it when it is only a clock, or fill it
 * from text when the model left it empty. Two equally strong amounts stay
 * unresolved so a THB annotation cannot overwrite a card amount by guessing.
 */
export function reconcileBankAppAmountMinor(input: {
  visionMinor: number | null;
  text: string;
}): { amountMinor: number | null; currency: CurrencyCode | null } {
  const { candidates, clockMinors } = collectBankAppAmountCandidates(input.text);
  const visionIsClock =
    input.visionMinor != null && clockMinors.has(input.visionMinor);
  if (input.visionMinor != null && !visionIsClock) {
    return { amountMinor: input.visionMinor, currency: null };
  }

  const withoutClock = candidates.filter(
    (candidate) => !clockMinors.has(candidate.amountMinor),
  );
  const pool = withoutClock.length > 0 ? withoutClock : candidates;
  const picked = pickBest(pool);
  if (!picked || picked.tied) {
    return { amountMinor: null, currency: null };
  }
  return {
    amountMinor: picked.candidate.amountMinor,
    currency: picked.candidate.currency,
  };
}

export function cleanBankAppMerchant(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;

  for (let i = 0; i < 6; i += 1) {
    AMOUNT_RE.lastIndex = 0;
    TYPE_WORD.lastIndex = 0;
    const next = text
      .replace(AMOUNT_RE, " ")
      .replace(TYPE_WORD, " ")
      .replace(EDGE_PUNCT, "")
      .replace(/\s+/g, " ")
      .trim();
    if (next === text) break;
    text = next;
  }

  text = text.replace(EDGE_PUNCT, "").replace(/\s+/g, " ").trim();
  return text || null;
}

function lineIsOnlyAmount(line: string): boolean {
  AMOUNT_RE.lastIndex = 0;
  const stripped = line.replace(AMOUNT_RE, " ").replace(EDGE_PUNCT, "").trim();
  return stripped.length === 0;
}

/** First non-date, non-amount line on a detail screen. Null when nothing remains. */
export function merchantLineFromBankAppText(text: string): string | null {
  for (const rawLine of text.replace(/\r/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || HEADER_LINE.test(line)) continue;
    if (lineHasDateContext(line) && !/(?:THB|SEK|EUR|USD|KR|kronor|฿|€|\$)/iu.test(line)) {
      continue;
    }
    if (lineIsOnlyAmount(line)) continue;
    const cleaned = cleanBankAppMerchant(line);
    if (cleaned) return cleaned;
  }
  return null;
}

/** Ledger description. Bank-app rows use the cleaned merchant; SMS keeps labelSv. */
export function importEventDescription(event: {
  labelSv: string;
  merchant?: string | null;
}): string {
  const merchant = event.merchant?.trim();
  if (merchant) return merchant;
  return event.labelSv;
}
