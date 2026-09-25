let message: string | null = null;
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

export function bankMailToastSnapshot(): string | null {
  return message;
}

export function subscribeBankMailToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishBankMailSavedToast(text: string) {
  message = text;
  for (const listener of listeners) listener();
}

export function dismissBankMailSavedToast() {
  if (!message) return;
  message = null;
  for (const listener of listeners) listener();
}
