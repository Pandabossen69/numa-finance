export type BankMailToast = { id: number; text: string };

let toast: BankMailToast | null = null;
let toastSeq = 0;
const listeners = new Set<() => void>();

export function bankMailSavedToast(input: {
  merchant: string;
  amountLabel: string;
  accountName: string;
}): string {
  const merchant = input.merchant.trim() || "Betalning";
  const account = input.accountName.trim() || "Konto";
  return `Sparat · ${merchant} · ${input.amountLabel} · ${account}`;
}

export function bankMailToastSnapshot(): BankMailToast | null {
  return toast;
}

export function subscribeBankMailToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishBankMailSavedToast(text: string) {
  toastSeq += 1;
  toast = { id: toastSeq, text };
  for (const listener of listeners) listener();
}

export function dismissBankMailSavedToast() {
  if (!toast) return;
  toast = null;
  for (const listener of listeners) listener();
}
