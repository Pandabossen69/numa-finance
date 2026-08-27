/**
 * Capture-step copy. Kvitto must stay receipt-specific —
 * never reuse SMS “Fota skärmen” / “Välj skärmdump”.
 */
export const CAPTURE_UI_COPY = {
  bank_sms: {
    eyebrow: "Bank-SMS",
    title: "Fota bank-SMS",
    titleBootstrap: "Fota senaste SMS",
    hint: "Fota SMS:et. Du bekräftar innan saldot sparas.",
    camera: "Fota skärmen nu",
    gallery: "Välj skärmdump",
    footer: "3–6 bubblor i samma bild går bra · samma SMS igen hoppas över",
    scanning: "Läser SMS…",
    scanningHint: "Du behöver inte skriva något.",
  },
  bank_app: {
    eyebrow: "Bankapp",
    title: "Fota bankapp",
    hint: "Fota beloppet i bankappen. Du bekräftar innan det sparas.",
    camera: "Fota skärmen nu",
    gallery: "Välj skärmdump",
    footer:
      "Bäst: detalj eller lista · € postas på bunq-konto · samma köp hoppas över",
    scanning: "Läser bankapp…",
    scanningHint: "Dubbelkolla beloppet innan du sparar.",
  },
  receipt: {
    eyebrow: "Kvitto",
    title: "Fota kvitto",
    hint: "Fota kvittot. Ändra beloppet om det behövs.",
    camera: "Fota kvittot",
    gallery: "Välj foto",
    footer: "Beloppet synligt i bild",
    scanning: "Läser kvitto…",
    scanningHint: "Dubbelkolla beloppet innan du sparar.",
  },
} as const;
