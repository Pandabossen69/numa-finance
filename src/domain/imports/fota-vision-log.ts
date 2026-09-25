/**
 * One redacted line when a bank-app screenshot produced no importable row.
 * Amounts, merchant text and image bytes stay out of the log.
 */
export type FotaVisionDropRow = {
  amountNull: boolean;
  currencyNull: boolean;
  occurredAtNull: boolean;
};

export type FotaVisionDropReport = {
  model: string | null;
  mode: string | null;
  detectedKind: string | null;
  rowCount: number;
  rows: FotaVisionDropRow[];
};

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export function fotaVisionDropReport(input: {
  model?: unknown;
  mode?: unknown;
  detectedKind?: unknown;
  rows: readonly {
    amountMajor?: unknown;
    currency?: unknown;
    occurredAt?: unknown;
  }[];
}): FotaVisionDropReport {
  return {
    model: typeof input.model === "string" ? input.model : null,
    mode: typeof input.mode === "string" ? input.mode : null,
    detectedKind: typeof input.detectedKind === "string" ? input.detectedKind : null,
    rowCount: input.rows.length,
    rows: input.rows.map((row) => ({
      amountNull: isBlank(row.amountMajor),
      currencyNull: isBlank(row.currency),
      occurredAtNull: isBlank(row.occurredAt),
    })),
  };
}

export function warnFotaVisionDrop(
  input: Parameters<typeof fotaVisionDropReport>[0],
): void {
  console.warn("[fota-vision]", fotaVisionDropReport(input));
}
