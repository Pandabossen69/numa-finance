/**
 * Capture-step copy. Kvitto must stay receipt-specific —
 * never reuse SMS “Fota skärmen” / “Välj skärmdump”.
 */
export const CAPTURE_UI_COPY = {
  bank_sms: {
    eyebrow: "Bank-SMS",
    title: "Fota bank-SMS",
    titleBootstrap: "Fota senaste SMS",
    hint: "Välj skärmdump från galleriet — eller fota skärmen. Vi läser alla bubblor (+/−) och sätter saldo.",
    camera: "Fota skärmen nu",
    gallery: "Välj skärmdump",
    footer: "3–6 bubblor i samma bild går bra · samma SMS igen hoppas över",
    scanning: "Läser SMS…",
    scanningHint:
      "Hämtar +/− och saldo automatiskt — du behöver inte skriva något.",
  },
  bank_app: {
    eyebrow: "Bankapp",
    title: "Fota bankapp",
    hint: "bunq / Revolut — kortbelopp i €, samma köp aldrig dubbelt",
    camera: "Fota skärmen nu",
    gallery: "Välj skärmdump",
    footer:
      "Bäst: detalj eller lista · € postas på bunq-konto · samma köp hoppas över",
    scanning: "Läser bankapp…",
    scanningHint:
      "Hämtar utgifter från skärmdumpen — misslyckade rader hoppas över.",
  },
  receipt: {
    eyebrow: "Kvitto",
    title: "Fota kvitto",
    hint: "Tillåt kameran om webbläsaren frågar. Håll texten skarp. Beloppet fylls i automatiskt — du kan alltid ändra innan du sparar.",
    camera: "Fota kvittot",
    gallery: "Välj foto",
    footer: "Beloppet synligt i bild",
    scanning: "Läser kvitto…",
    scanningHint: "Hämtar beloppet — dubbelkolla innan du sparar.",
  },
} as const;
