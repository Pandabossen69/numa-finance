/**
 * Last-known «Att bekräfta» count. Seed does not bump the version: a Hem
 * read that already started still applies, and a Bekräfta/Avvisa publish
 * that landed during that read still wins.
 */
let pendingCount: number | null = null;
let pendingCountVersion = 0;
const countListeners = new Set<() => void>();

function notify() {
  for (const listener of countListeners) listener();
}

export function bankMailPendingCountSnapshot(): number | null {
  return pendingCount;
}

export function subscribeBankMailPendingCount(listener: () => void) {
  countListeners.add(listener);
  return () => {
    countListeners.delete(listener);
  };
}

export function bankMailPendingCountVersion(): number {
  return pendingCountVersion;
}

/** Paint the last-known count before the live read. Not a mutation. */
export function seedBankMailPendingCount(count: number) {
  if (pendingCount != null) return;
  if (!Number.isInteger(count) || count < 0) return;
  pendingCount = count;
  notify();
}

export function publishBankMailPendingCount(count: number) {
  pendingCountVersion += 1;
  pendingCount = count;
  notify();
}

export function clearBankMailPendingCount() {
  if (pendingCount == null && pendingCountVersion === 0) return;
  pendingCount = null;
  pendingCountVersion += 1;
  notify();
}

export function resetBankMailPendingCountForTests() {
  pendingCount = null;
  pendingCountVersion = 0;
  countListeners.clear();
}
