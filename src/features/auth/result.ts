export type AuthResult =
  | { ok: true; nextPath: string; userId: string }
  | { ok: false; error: string };
