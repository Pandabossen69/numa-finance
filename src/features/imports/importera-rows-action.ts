"use server";

import type { ImporteraRow } from "@/features/home/last-snapshot";
import { loadImporteraRows } from "@/features/imports/load-importera-rows";

/**
 * Kept for callers that already hold a server-action reference.
 * Cold start uses GET /api/numa/read?part=importera so the list is not
 * stuck behind the client action queue. No revalidatePath.
 */
export async function loadImporteraRowsAction(): Promise<ImporteraRow[]> {
  return loadImporteraRows();
}
