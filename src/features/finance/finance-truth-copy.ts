import type { FinanceTruthStatus } from "@/domain/finance";

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
