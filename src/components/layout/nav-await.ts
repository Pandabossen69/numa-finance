import { primaryTab } from "@/components/layout/nav";

export type NavAwaitSnapshot = {
  href: string;
  fromPath: string;
};

/** Last tap wins. Earlier intents never become the visible destination. */
export function lastNavIntent(
  intents: readonly NavAwaitSnapshot[],
): NavAwaitSnapshot | null {
  if (intents.length === 0) return null;
  return intents[intents.length - 1];
}

/**
 * URL already matches dest, but the outlet still holds the previous page.
 * Dest shell / dest cache must paint until children actually swap.
 */
export function isOutletStale(input: {
  awaitHref: string | null;
  pathTab: string | null;
  destTab: string | null;
  childrenFrozen: boolean;
}): boolean {
  if (!input.awaitHref || !input.destTab || !input.childrenFrozen) return false;
  return (
    input.pathTab === input.destTab &&
    input.destTab === primaryTab(input.awaitHref)
  );
}

/** Dest children arrived for the current intent — safe to release the shell. */
export function destChildrenArrived(input: {
  awaitHref: string | null;
  pathname: string;
  childrenFrozen: boolean;
  hadFreeze: boolean;
}): boolean {
  if (!input.awaitHref || input.childrenFrozen || !input.hadFreeze) return false;
  return primaryTab(input.pathname) === primaryTab(input.awaitHref);
}
