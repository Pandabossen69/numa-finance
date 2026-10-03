/**
 * Node and browsers disagree on the sv-SE grouping space (NBSP vs NNBSP).
 * A single ASCII space keeps SSR and the client on the same text (React #418).
 */
const GROUP_SPACE = /[\u00A0\u202F\u2007\u2009]/g;

export function stableSvText(value: string): string {
  return value.replace(GROUP_SPACE, " ");
}
