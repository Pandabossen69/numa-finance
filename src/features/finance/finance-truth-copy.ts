import type { FinanceTruthStatus } from "@/domain/finance";

export type FinanceTruthBannerInput = {
  truthStatus?: FinanceTruthStatus | "verified" | "stale" | "unavailable";
  /** Save / refresh-pending copy must never trigger the truth banner. */
  error?: string | null;
  refreshPending?: boolean;
};

/**
 * The Hem banner is only for missing/stale money truth.
 * A successful write with "Sparat. Uppdaterar siffrorna…" is not a calculation failure.
 */
export function shouldShowFinanceTruthBanner(
  input: FinanceTruthBannerInput,
): boolean {
  if (input.refreshPending) return false;
  return input.truthStatus === "stale" || input.truthStatus === "unavailable";
}

/** Swedish fail-soft copy when money truth is missing or only last-known. */
export function financeTruthMessageSv(input: {
  truthStatus?: FinanceTruthStatus | "verified" | "stale" | "unavailable";
  verifiedAt?: string | null;
  timeZone?: string;
}): { title: string; detail: string | null } {
  const status = input.truthStatus ?? "unavailable";
  if (status === "verified") {
    return { title: "", detail: null };
  }
  const verifiedLabel = formatVerifiedClockSv(input.verifiedAt, input.timeZone);
  if (status === "stale" && verifiedLabel) {
    return {
      title: "Vi kan inte räkna just nu.",
      detail: `Senast verifierad ${verifiedLabel}.`,
    };
  }
  return {
    title: "Vi kan inte räkna just nu.",
    detail: verifiedLabel ? `Senast verifierad ${verifiedLabel}.` : null,
  };
}

function formatVerifiedClockSv(
  verifiedAt: string | null | undefined,
  timeZone = "Asia/Bangkok",
): string | null {
  if (!verifiedAt) return null;
  const ms = Date.parse(verifiedAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}
