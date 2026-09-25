/**
 * Swedish copy for “these rows are already in NUMA”.
 * The number is always the length of the list on screen.
 */
export function alreadyKnownMovementsMessage(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 1) return "Den här rörelsen finns redan.";
  if (n <= 0) return "Det här finns redan sparat i NUMA.";
  return `Alla ${n} rörelser finns redan.`;
}

export function skippedSavedMovementsMessage(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 1) return "1 redan sparad hoppades över.";
  return `${n} redan sparade hoppades över.`;
}

export function skippedFailedMovementsMessage(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 1) return "1 misslyckad hoppades över.";
  return `${n} misslyckade hoppades över.`;
}

const ALREADY_KNOWN_RE = /Alla \d+ rörelser finns redan/;

/**
 * If the baked sentence names a different count than the rows we render,
 * speak the rendered count. «Alla 2 rörelser finns redan» must not sit on
 * a list of 3.
 */
export function presentAlreadyKnownMessage(input: {
  listedCount: number;
  serverMessage?: string | null;
}): string {
  const listed = Math.max(0, Math.trunc(input.listedCount));
  if (listed > 0) {
    const fresh = alreadyKnownMovementsMessage(listed);
    const server = (input.serverMessage ?? "").trim();
    const suffix = server.match(/Alla \d+ rörelser finns redan\.?\s*(.*)$/);
    const rest = suffix?.[1]?.trim() ?? "";
    if (rest && !/^sparade\b/i.test(rest)) return `${fresh} ${rest}`;
    return fresh;
  }
  const server = input.serverMessage ?? "";
  const match = server.match(/Alla (\d+) rörelser finns redan/);
  if (match) return alreadyKnownMovementsMessage(Number(match[1]));
  if (server.trim()) return server;
  return alreadyKnownMovementsMessage(1);
}

export function messageMentionsAlreadyKnownCount(message: string | null | undefined): boolean {
  return Boolean(message && ALREADY_KNOWN_RE.test(message));
}
