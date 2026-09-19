import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";

/** Same bucket Per kategori uses for a blank/null category. */
export function spendCategoryName(
  category: string | null | undefined,
): string {
  const name = category?.trim();
  return name ? name : UNCATEGORISED_SPEND_NAME;
}

export function matchesCategory(
  category: string | null | undefined,
  selected: string | null,
): boolean {
  if (!selected) return true;
  return spendCategoryName(category) === selected;
}

export function toggleCategory(
  current: string | null,
  next: string,
): string | null {
  return current === next ? null : next;
}
