import {
  PLAN_CATEGORY_KINDS,
  type PlanCategoryKind,
  type PlanItem,
} from "./types";

export const PLAN_KIND_INVALID_SV = "Ogiltig plantyp";
export const PLAN_SAVE_FAILED_SV = "Kunde inte spara planposten";
export const PLAN_UPDATE_FAILED_SV = "Kunde inte uppdatera planposten";

export function isPlanCategoryKind(value: unknown): value is PlanCategoryKind {
  return (
    typeof value === "string" &&
    (PLAN_CATEGORY_KINDS as readonly string[]).includes(value)
  );
}

export function parsePlanCategoryKind(value: unknown): PlanCategoryKind {
  if (isPlanCategoryKind(value)) return value;
  throw new Error(PLAN_KIND_INVALID_SV);
}

const KNOWN_SV_ERRORS = new Set([
  "Belopp kan inte vara negativt",
  PLAN_KIND_INVALID_SV,
  PLAN_SAVE_FAILED_SV,
  PLAN_UPDATE_FAILED_SV,
  "Planposten hittades inte",
  "Du måste logga in",
  "Belopp måste vara större än 0",
]);

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** True when the failure is a known validation/business message, not a crash. */
export function isExpectedPlanWriteError(error: unknown): boolean {
  const message = rawMessage(error);
  if (KNOWN_SV_ERRORS.has(message)) return true;
  if (message.includes("kan inte vara lägre än")) return true;
  if (/invalid_type|too_small|too_big|invalid_string|invalid_format/i.test(message)) {
    return true;
  }
  return false;
}

export function isPlanKindTypeError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("plan_category_kind") ||
    /invalid input value for enum/i.test(message) ||
    /coalesce types text and plan_category_kind/i.test(message)
  );
}

function looksLikeDatabaseDump(message: string): boolean {
  return /column "|relation "|syntax error|permission denied|violates |sqlstate|postgres|coalesce types|expression is of type|invalid input value for enum|type mismatch/i.test(
    message,
  );
}

function looksLikeSafeSwedish(message: string): boolean {
  if (message.length === 0 || message.length > 120) return false;
  if (looksLikeDatabaseDump(message)) return false;
  return /[åäöÅÄÖ]/.test(message) || KNOWN_SV_ERRORS.has(message);
}

/** Map raw save/update failures to a short Swedish line. Never leak Postgres. */
export function planWriteUserError(error: unknown, fallback: string): string {
  const message = rawMessage(error);
  if (KNOWN_SV_ERRORS.has(message)) return message;
  if (isPlanKindTypeError(message)) return PLAN_KIND_INVALID_SV;
  if (message === "not authenticated") return "Du måste logga in";
  if (message === "plan item not found") return "Planposten hittades inte";
  if (looksLikeSafeSwedish(message)) return message;
  if (looksLikeDatabaseDump(message)) return fallback;
  return fallback;
}

/** Log-safe error: no emails, UUIDs, or long payloads. */
export function toSafePlanLogError(error: unknown): Error {
  const message = rawMessage(error)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[id]",
    )
    .slice(0, 240);
  return new Error(message || "plan write failed");
}

export type SavePlanItemDraft = {
  id?: string | null;
  name: string;
  kind?: string | null;
  amountMinor: number;
  currency: PlanItem["currency"];
  cadence?: string | null;
  nextDueAt?: string | null;
  isActive?: boolean;
};

/**
 * In-memory twin of `save_plan_item` kind handling (create + edit).
 * Does not book ledger or change economic rules.
 */
export function applySavePlanItem(
  existing: readonly PlanItem[],
  input: SavePlanItemDraft,
  opts: { nowIso: string; newId: () => string; userId: string },
): PlanItem {
  if (input.amountMinor < 0) {
    throw new Error("Belopp kan inte vara negativt");
  }

  if (input.id) {
    const current = existing.find((row) => row.id === input.id);
    if (!current) throw new Error("Planposten hittades inte");
    const kind =
      input.kind == null || input.kind === ""
        ? current.kind
        : parsePlanCategoryKind(input.kind);
    return {
      ...current,
      name: input.name.trim() || current.name,
      kind,
      amountMinor: input.amountMinor,
      cadence: input.cadence ?? current.cadence,
      nextDueAt:
        input.nextDueAt === undefined ? current.nextDueAt : input.nextDueAt,
      isActive: input.isActive ?? current.isActive,
      updatedAt: opts.nowIso,
    };
  }

  const kind = parsePlanCategoryKind(input.kind);
  return {
    id: opts.newId(),
    userId: opts.userId,
    name: input.name.trim(),
    kind,
    amountMinor: input.amountMinor,
    currency: input.currency,
    cadence: input.cadence ?? "monthly",
    nextDueAt: input.nextDueAt ?? null,
    isActive: input.isActive ?? true,
    settledAt: null,
    settledMinor: null,
    remainingDueAt: null,
    createdAt: opts.nowIso,
    updatedAt: opts.nowIso,
  };
}
