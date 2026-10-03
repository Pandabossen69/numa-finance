/**
 * getServerSnapshot for useSyncExternalStore.
 * Must return the same value on the server and on the client's first pass.
 * Reading persist / module caches here is what throws React #418 on soft-nav.
 */
export function serverNull(): null {
  return null;
}

export function serverZero(): number {
  return 0;
}

export function serverBlank(): string {
  return "";
}
