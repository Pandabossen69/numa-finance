/**
 * Analys → Rörelser drill lives only in the URL.
 * The remembered Rörelser view is the user's own chips and is never
 * overwritten by a drill.
 *
 * `/transaktioner?drill=1&period=month|cycle&from=..&to=..&filter=expense&cat=`
 */

export type MovementsDrill = {
  period: "month" | "cycle";
  filter: "expense";
  /** Category name, same bucket as Per kategori (Övrigt, Mat, …). */
  category: string;
  from: string | null;
  to: string | null;
};

/**
 * Spenderat row → Rörelser query.
 *
 * Månad always opens Denna månad + Utgifter. It must not copy a saved
 * All tid / Alla view: that mapping is why September → Övrigt showed
 * every row (prod 7dd0576 and the XA previews).
 * Perioden uses the pay-cycle window so the list matches Spenderat.
 */
export function movementsDrillForCategory(
  categoryName: string,
  opts: {
    scope: "period" | "month";
    cycleStartAt?: string | null;
    cycleEndAt?: string | null;
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
  };
}

export function movementsDrillHref(drill: MovementsDrill): string {
  const params = new URLSearchParams();
  params.set("drill", "1");
  params.set("period", drill.period);
  params.set("filter", drill.filter);
  params.set("cat", drill.category);
  if (drill.from) params.set("from", drill.from);
  if (drill.to) params.set("to", drill.to);
  return `/transaktioner?${params.toString()}`;
}

export function movementsDrillFromSearch(search: string): MovementsDrill | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (params.get("drill") !== "1") return null;
  const period = params.get("period");
  if (period !== "month" && period !== "cycle") return null;
  if (params.get("filter") !== "expense") return null;
  const category = params.get("cat");
  if (!category) return null;
  return {
    period,
    filter: "expense",
    category,
    from: params.get("from"),
    to: params.get("to"),
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
    a.to === b.to
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
