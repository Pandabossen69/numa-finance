import { labelMonthNameSv } from "@/domain/finance";

/**
 * Analys → Rörelser drill lives only in the URL.
 * The remembered Rörelser view is the user's own chips and is never
 * overwritten by a drill.
 *
 * `/transaktioner?drill=1&period=month|cycle&from=..&to=..&filter=expense&cat=`
 */

export type MovementsDrill = {
  period: "month" | "cycle";
  /** expense = category drill. all = Senaste «Alla →», no category chip. */
  filter: "expense" | "all";
  /** Category name, same bucket as Per kategori (Övrigt, Mat, …). */
  category: string | null;
  from: string | null;
  to: string | null;
  /**
   * Calendar month for period=month. Omitted means Rörelser' own month.
   * Not written into the saved view.
   */
  monthKey?: string | null;
};

/**
 * Spenderat row → Rörelser query.
 *
 * Månad opens Utgifter for the browsed calendar month when `monthKey` is
 * set. The chip is that month («September»), an overlay only — the saved
 * All tid / Alla view is never copied (prod 7dd0576). Omitting `monthKey`
 * leaves Rörelser on its own month.
 * Perioden uses the pay-cycle window so the list matches Spenderat.
 */
export function movementsDrillForCategory(
  categoryName: string,
  opts: {
    scope: "period" | "month";
    cycleStartAt?: string | null;
    cycleEndAt?: string | null;
    /** Calendar month Analys is showing. Used only for scope "month". */
    monthKey?: string | null;
  },
): MovementsDrill {
  if (opts.scope === "period") {
    return {
      period: "cycle",
      filter: "expense",
      category: categoryName,
      from: opts.cycleStartAt ?? null,
      to: opts.cycleEndAt ?? null,
    };
  }
  return {
    period: "month",
    filter: "expense",
    category: categoryName,
    from: null,
    to: null,
    ...(opts.monthKey ? { monthKey: opts.monthKey } : {}),
  };
}

/**
 * Senaste «Alla →». Same window as the list on screen.
 * Query only — the saved Rörelser chips stay whatever the user had.
 */
export function senasteAllaHref(input: {
  scope: "period" | "month";
  monthKey: string;
  cycleStartAt?: string | null;
  cycleEndAt?: string | null;
}): string {
  if (input.scope === "month") {
    return movementsDrillHref({
      period: "month",
      filter: "all",
      category: null,
      from: null,
      to: null,
      monthKey: input.monthKey,
    });
  }
  return movementsDrillHref({
    period: "cycle",
    filter: "all",
    category: null,
    from: input.cycleStartAt ?? null,
    to: input.cycleEndAt ?? null,
    monthKey: null,
  });
}

/**
 * Chip label for a drill that pins a calendar month.
 * «September», not «Denna månad». Overlay only — never a saved chip.
 */
export function drillMonthChipLabel(
  monthKey: string | null | undefined,
): string | null {
  if (!monthKey || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return null;
  const name = labelMonthNameSv(monthKey);
  if (!name || name.toLowerCase().includes("invalid")) return null;
  return name.charAt(0).toLocaleUpperCase("sv-SE") + name.slice(1);
}

export function movementsDrillHref(drill: MovementsDrill): string {
  const params = new URLSearchParams();
  params.set("drill", "1");
  params.set("period", drill.period);
  params.set("filter", drill.filter);
  if (drill.category) params.set("cat", drill.category);
  if (drill.from) params.set("from", drill.from);
  if (drill.to) params.set("to", drill.to);
  if (drill.monthKey) params.set("month", drill.monthKey);
  return `/transaktioner?${params.toString()}`;
}

export function movementsDrillFromSearch(search: string): MovementsDrill | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (params.get("drill") !== "1") return null;
  const period = params.get("period");
  if (period !== "month" && period !== "cycle") return null;
  const filterParam = params.get("filter") ?? "all";
  if (filterParam !== "expense" && filterParam !== "all") return null;
  const category = params.get("cat");
  if (filterParam === "expense" && !category) return null;
  return {
    period,
    filter: filterParam,
    category: category || null,
    from: params.get("from"),
    to: params.get("to"),
    ...(params.get("month") ? { monthKey: params.get("month") } : {}),
  };
}

export function movementsDrillFromHref(href: string): MovementsDrill | null {
  try {
    const url = new URL(href, "http://numa.local");
    return movementsDrillFromSearch(url.search);
  } catch {
    return null;
  }
}

let drill: MovementsDrill | null = null;
const listeners = new Set<() => void>();

function sameDrill(a: MovementsDrill | null, b: MovementsDrill | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.period === b.period &&
    a.filter === b.filter &&
    a.category === b.category &&
    a.from === b.from &&
    a.to === b.to &&
    (a.monthKey ?? null) === (b.monthKey ?? null)
  );
}

/** Parked Rörelser reads this. A href without drill params clears it. */
export function rememberMovementsDrillFromHref(href: string): void {
  const next = movementsDrillFromHref(href);
  if (sameDrill(drill, next)) return;
  drill = next;
  for (const listener of listeners) listener();
}

export function clearMovementsDrill(): void {
  if (!drill) return;
  drill = null;
  for (const listener of listeners) listener();
}

export function lastMovementsDrill(): MovementsDrill | null {
  return drill;
}

export function subscribeMovementsDrill(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetMovementsDrillForTests(): void {
  drill = null;
  listeners.clear();
}
