export const AUTH_COPY = {
  genericError: "Något gick fel. Försök igen om en liten stund.",
  signInFailed: "Kunde inte logga in just nu. Försök igen.",
  signUpFailed: "Kunde inte skapa kontot just nu. Försök igen.",
  resetFailed: "Kunde inte skicka återställningslänken just nu. Försök igen.",
  updateFailed: "Kunde inte spara det nya lösenordet just nu. Försök igen.",
  confirmEmail:
    "Nästan klart! Vi har skickat ett mejl till dig — öppna länken i mejlet för att bekräfta adressen. Titta även i skräpposten. Sedan kan du logga in.",
  resetEmailSent:
    "Kolla din e-post — om adressen finns hos oss har vi skickat en länk för att välja nytt lösenord. Titta även i skräpposten.",
  passwordUpdated: "Ditt lösenord är uppdaterat. Du är inloggad igen.",
  recoveryLinkExpired:
    "Länken har gått ut eller är redan använd. Begär en ny återställningslänk nedan.",
  emailLinkExpired:
    "Länken i mejlet har gått ut eller är redan använd. Logga in, eller välj “Glömt lösenord?” för att få en ny länk.",
  recoverySessionMissing:
    "Vi kunde inte verifiera återställningslänken. Begär en ny länk och öppna den på samma enhet.",
  notConfigured:
    "Inloggningen är inte färdigkonfigurerad. Kontakta den som satt upp NUMA.",
  invalidEmail: "Ange en giltig e-postadress",
  shortPassword: "Lösenordet måste vara minst 8 tecken",
} as const;

const RULES: ReadonlyArray<{ match: readonly string[]; text: string }> = [
  {
    match: ["invalid login", "invalid_credentials", "invalid grant"],
    text: "Fel e-post eller lösenord. Kontrollera uppgifterna och försök igen.",
  },
  {
    match: ["email not confirmed", "email_not_confirmed"],
    text: "E-postadressen är inte bekräftad ännu. Öppna länken i mejlet vi skickade — kolla även skräpposten.",
  },
  {
    match: [
      "already registered",
      "already been registered",
      "user_already_exists",
      "email address already",
    ],
    text: "Det finns redan ett konto med den här e-postadressen. Logga in, eller återställ lösenordet om du har glömt det.",
  },
  {
    match: ["password should be at least", "weak_password", "password is too short"],
    text: "Lösenordet är för kort. Använd minst 8 tecken.",
  },
  {
    match: ["password should contain", "password does not meet"],
    text: "Lösenordet uppfyller inte kraven. Blanda gärna bokstäver, siffror och tecken.",
  },
  {
    match: ["new password should be different", "same_password"],
    text: "Det nya lösenordet måste skilja sig från det gamla.",
  },
  {
    match: ["email rate limit", "over_email_send_rate_limit"],
    text: "Vi har skickat många mejl till den här adressen. Vänta en stund och försök igen.",
  },
  {
    match: ["too many requests", "rate limit", "over_request_rate_limit"],
    text: "För många försök just nu. Vänta en stund och försök igen.",
  },
  {
    match: [
      "token has expired",
      "otp_expired",
      "invalid or has expired",
      "expired or is invalid",
      "flow state expired",
      "code verifier",
      "pkce",
    ],
    text: AUTH_COPY.recoveryLinkExpired,
  },
  {
    match: [
      "auth session missing",
      "session_not_found",
      "jwt expired",
      "refresh token",
    ],
    text: "Din session har gått ut. Logga in igen för att fortsätta.",
  },
  {
    match: ["unable to validate email", "invalid email", "email_address_invalid"],
    text: "E-postadressen ser inte giltig ut. Kontrollera stavningen.",
  },
  {
    match: ["user not found", "user_not_found"],
    text: "Vi hittade inget konto med den e-postadressen.",
  },
  {
    match: ["captcha"],
    text: "Säkerhetskontrollen misslyckades. Ladda om sidan och försök igen.",
  },
  {
    match: ["fetch failed", "network", "timeout", "econnrefused", "enotfound"],
    text: "Vi når inte servern just nu. Kontrollera din uppkoppling och försök igen.",
  },
  {
    match: ["supabase is not configured", "not configured"],
    text: AUTH_COPY.notConfigured,
  },
];

const SIGNUP_DISABLED = [
  "signups not allowed",
  "signup is disabled",
  "signups are disabled",
  "email signups are disabled",
  "signup_disabled",
];

/** Swedish copy for the `?fel=` codes the auth callback redirects with. */
export function authNoticeFromCode(
  code: string | string[] | undefined,
  context: "login" | "reset",
): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  switch (value) {
    case "lank":
      return context === "reset"
        ? AUTH_COPY.recoveryLinkExpired
        : AUTH_COPY.emailLinkExpired;
    case "konfiguration":
      return AUTH_COPY.notConfigured;
    case "session":
      return AUTH_COPY.recoverySessionMissing;
    default:
      return AUTH_COPY.genericError;
  }
}

/**
 * Maps a Supabase (English) auth error to Swedish user-facing copy.
 * Unknown messages fall back to `fallback` — raw English never reaches the UI.
 */
export function swedishAuthError(
  message: string | undefined | null,
  fallback: string = AUTH_COPY.genericError,
): string {
  if (!message) return fallback;
  const lower = message.toLowerCase();

  if (SIGNUP_DISABLED.some((needle) => lower.includes(needle))) {
    return "Det går inte att skapa nya konton just nu. Försök igen senare.";
  }

  const seconds = lower.match(
    /you can only request this after (\d+) second/,
  )?.[1];
  if (seconds) {
    return `Vänta ${seconds} sekunder innan du begär ett nytt mejl.`;
  }

  for (const rule of RULES) {
    if (rule.match.some((needle) => lower.includes(needle))) {
      return rule.text;
    }
  }

  return fallback;
}
