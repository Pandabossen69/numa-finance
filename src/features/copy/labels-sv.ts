/**
 * Shared Swedish product copy — keep labels identical across Hem / Analys / Plan / Fota.
 *
 * Vocabulary (sticky day envelope):
 * - Dagsbudget: morning allowance for today (does not fall mid-day)
 * - Kvar idag: dagsbudget − spenderat idag
 * - Spenderat idag: confirmed expenses this calendar day (inkl. bank-SMS)
 * - Kvar i perioden: free money left for the whole pay cycle
 * - Spenderat i perioden: spending since cycle start (inkl. bank-SMS)
 *
 * Vocabulary (cash vs plan — do not mix):
 * - Saldo / På kontot: verified bank / calculated account balance
 * - Mot planen: calendar-month plan leftover minus actual spend (+ extra)
 * - Plan + sparande: mot planen + avsatt sparande (not cash on hand)
 * - Kvar i månaden (plan): income − planned expenses − savings (no actual spend)
 */
export const SV = {
  kvarIdag: "Kvar idag",
  dagsbudget: "Dagsbudget",
  spenderatIdag: "Spenderat idag",
  kvarIPerioden: "Kvar i perioden",
  spenderatIPerioden: "Spenderat i perioden",
  extraSaldo: "Extra saldo",
  extraMed: "Extra med",
  iManaden: "I månaden",
  alltINuma: "Plan + sparande",
  sparandeTotalt: "Sparat i NUMA",
  overskottHittills: "Överskott mot planen",
  minusMotPlanen: "Minus mot planen",
  motPlanen: "Mot planen",
  kvarIManadenPlan: "Kvar i månaden (plan)",
  planOchSparande: "Plan och sparande",
  spenderatIManaden: "Spenderat i månaden",
  sparande: "Sparande",
  saldo: "Saldo",
  merPathSaldo: "Mer → Saldo",
  paKontot: "På kontot",
  saldoLevaFor: "Att leva för",
  sparandeAvsatt: "Ligger avsatt",
  vaxer: "Växer",
  intakter: "Intäkter",
  utgifter: "Utgifter",
  laggtillUtgift: "Lägg till utgift",
  laggtillUtgiftHint: "Sparas direkt mot idag",
  fota: "Fota",
  fotaHint: "SMS, kvitto eller belopp",
  plan: "Plan",
  planHint: "Intäkter och utgifter",
  dagarKvar: (n: number, word: string) => `${n} ${word} kvar`,
  overDagsbudget: "Över dagsbudgeten",
  underDagsbudget: "Inom dagsbudgeten",
  paGransenIdag: "Exakt på dagsbudgeten",
  uppdateraSaldo: "Uppdatera saldo",
  komIgång: "Kom igång",
  hurMycketKvar: "Hur mycket har du kvar på kontot?",
  visaDagsbudget: "Visa dagsbudget",
  perioden: "Perioden",
  manad: "Månad",
  saRaknarNuma: "Så räknar NUMA",
  idag: "Idag",
  appDescription:
    "Din dagsbudget — se vad som är kvar idag, planera och håll koll på saldot.",
  notFoundHint: "Gå tillbaka till Hem — där ser du hur mycket som är kvar idag.",
} as const;
