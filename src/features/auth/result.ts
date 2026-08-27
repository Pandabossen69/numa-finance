export type AuthResult =
  | { ok: true; nextPath: string }
  | { ok: false; error: string };
