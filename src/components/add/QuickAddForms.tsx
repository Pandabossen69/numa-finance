"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useSubmitGuard } from "@/lib/forms/submit-guard";
import {
  createCashWithdrawalAction,
  createExpenseAction,
  createIncomeAction,
  createTransferAction,
} from "@/features/finance/actions";
import { SV } from "@/features/copy/labels-sv";
import { parseUiAmountToMinor } from "@/domain/money";
import {
  applyAccountDelta,
  applyLocalTransfer,
  applyMovementsAdd,
  applyOptimisticHomeIncome,
  applyOptimisticHomeSpend,
  confirmOptimisticFinance,
  lastHomeSnapshot,
} from "@/features/home/last-snapshot";

export type ShellAccount = {
  id: string;
  name: string;
  accountType: string;
  currency?: string;
};

const CATEGORIES = ["Mat", "Transport", "Shopping", "Boende", "Övrigt"] as const;
const LAST_CATEGORY_KEY = "numa.lastExpenseCategory";
const DEFAULT_CATEGORY: (typeof CATEGORIES)[number] = "Mat";

function readLastExpenseCategory(): string {
  try {
    const saved = localStorage.getItem(LAST_CATEGORY_KEY);
    if (saved && (CATEGORIES as readonly string[]).includes(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CATEGORY;
}

function subscribeLastExpenseCategory(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_CATEGORY_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

type Mode = "expense" | "income" | "transfer" | "cash";

export function QuickAddForms({
  primaryAccountId,
  accounts,
  onSuccess,
}: {
  primaryAccountId: string;
  accounts: ShellAccount[];
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("expense");
  const modes: Array<{ id: Mode; label: string }> = [
    { id: "expense", label: "Utgift" },
    { id: "income", label: "Inkomst" },
    { id: "transfer", label: "Flytta" },
    { id: "cash", label: "Kontant" },
  ];

  function handleSuccess() {
    onSuccess?.();
  }

  return (
    <div className="space-y-4">
      <div className="numa-equal-chips is-quad">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`numa-press min-h-11 rounded-full px-2.5 text-sm ${
              mode === m.id
                ? "bg-[var(--numa-ink)] font-semibold text-[var(--numa-card)]"
                : "bg-[var(--numa-card)] font-medium text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "expense" ? (
        <ExpenseForm
          accountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() => handleSuccess()}
        />
      ) : null}
      {mode === "income" ? (
        <IncomeForm
          accountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() => handleSuccess()}
        />
      ) : null}
      {mode === "transfer" ? (
        <TransferForm
          primaryAccountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() => handleSuccess()}
        />
      ) : null}
      {mode === "cash" ? (
        <CashForm
          primaryAccountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() => handleSuccess()}
        />
      ) : null}
    </div>
  );
}

function ExpenseForm({
  accountId,
  accounts,
  onSuccess,
}: {
  accountId: string;
  accounts: ShellAccount[];
  onSuccess?: () => void;
}) {
  const [chosenAccountId, setChosenAccountId] = useState(accountId);
  const [amount, setAmount] = useState("");
  const storedCategory = useSyncExternalStore(
    subscribeLastExpenseCategory,
    readLastExpenseCategory,
    () => DEFAULT_CATEGORY,
  );
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const category = categoryOverride ?? storedCategory;
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!guard.tryBegin()) return;
        setError(null);
        startTransition(async () => {
          let amountMinor: number;
          try {
            amountMinor = parseUiAmountToMinor(amount);
          } catch {
            setError("Ogiltigt belopp");
            return;
          }
          if (amountMinor <= 0) {
            setError("Beloppet måste vara större än 0");
            return;
          }
          const descriptionText = description.trim() || "Utgift";
          const currency = lastHomeSnapshot()?.currency ?? "THB";
          applyOptimisticHomeSpend(amountMinor);
          applyAccountDelta(-amountMinor, chosenAccountId);
          try {
            localStorage.setItem(LAST_CATEGORY_KEY, category);
          } catch {
            // ignore
          }
          const result = await createExpenseAction({
            accountId: chosenAccountId,
            amount,
            category,
            description: description || undefined,
          });
          if (!result.ok) {
            applyOptimisticHomeSpend(-amountMinor);
            applyAccountDelta(amountMinor, chosenAccountId);
            setError(result.error);
            return;
          }
          confirmOptimisticFinance();
          applyMovementsAdd({
            id: result.id ?? crypto.randomUUID(),
            description: descriptionText,
            category,
            transactionType: "expense",
            direction: "debit",
            amountMinor,
            currency,
            occurredAt: new Date().toISOString(),
            source: "manual",
          });
          setAmount("");
          setDescription("");
          onSuccess?.();
        });
      }}
    >
      {accounts.length > 0 ? (
        <AccountSelect
          label="Konto"
          value={chosenAccountId}
          onChange={setChosenAccountId}
          accounts={accounts}
        />
      ) : null}
      <AmountField value={amount} onChange={setAmount} />
      <div className="numa-chip-scroll">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryOverride(c)}
            className={`numa-press min-h-11 rounded-full px-3 text-sm ${
              category === c
                ? "bg-[var(--numa-ink)] font-semibold text-[var(--numa-card)]"
                : "bg-[var(--numa-card)] font-medium text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <TextField
        value={description}
        onChange={setDescription}
        placeholder="Valfri beskrivning"
      />
      <ErrorText error={error} />
      <Submit pending={pending} disabled={!amount.trim()} label="Spara utgift" />
    </form>
  );
}

function IncomeForm({
  accountId,
  accounts,
  onSuccess,
}: {
  accountId: string;
  accounts: ShellAccount[];
  onSuccess?: () => void;
}) {
  const [targetId, setTargetId] = useState(accountId);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!guard.tryBegin()) return;
        setError(null);
        startTransition(async () => {
          let amountMinor: number;
          try {
            amountMinor = parseUiAmountToMinor(amount);
          } catch {
            setError("Ogiltigt belopp");
            return;
          }
          if (amountMinor <= 0) {
            setError("Beloppet måste vara större än 0");
            return;
          }
          const descriptionText = description.trim() || "Inkomst";
          const currency = lastHomeSnapshot()?.currency ?? "THB";
          applyOptimisticHomeIncome(amountMinor);
          applyAccountDelta(amountMinor, targetId);
          const result = await createIncomeAction({
            accountId: targetId,
            amount,
            description: description || undefined,
          });
          if (!result.ok) {
            applyOptimisticHomeIncome(-amountMinor);
            applyAccountDelta(-amountMinor, targetId);
            setError(result.error);
            return;
          }
          confirmOptimisticFinance();
          applyMovementsAdd({
            id: result.id ?? crypto.randomUUID(),
            description: descriptionText,
            category: null,
            transactionType: "income",
            direction: "credit",
            amountMinor,
            currency,
            occurredAt: new Date().toISOString(),
            source: "manual",
          });
          setAmount("");
          setDescription("");
          onSuccess?.();
        });
      }}
    >
      <p className="text-sm text-[var(--numa-muted)]">
        Lön, återbetalning eller annat som ökar saldot.
      </p>
      {accounts.length > 1 ? (
        <AccountSelect
          label="Till konto"
          value={targetId}
          onChange={setTargetId}
          accounts={accounts}
        />
      ) : null}
      <AmountField value={amount} onChange={setAmount} />
      <TextField
        value={description}
        onChange={setDescription}
        placeholder="t.ex. Lön"
      />
      <ErrorText error={error} />
      <Submit pending={pending} disabled={!amount.trim()} label="Spara inkomst" />
    </form>
  );
}

function TransferForm({
  primaryAccountId,
  accounts,
  onSuccess,
}: {
  primaryAccountId: string;
  accounts: ShellAccount[];
  onSuccess?: () => void;
}) {
  const others = accounts.filter((a) => a.id !== primaryAccountId);
  const [fromId, setFromId] = useState(primaryAccountId);
  const [toId, setToId] = useState(others[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);

  const fromAccount = accounts.find((a) => a.id === fromId);
  const fromCurrency = fromAccount?.currency ?? "THB";
  const compatibleDestinations = useMemo(
    () =>
      accounts.filter(
        (a) => a.id !== fromId && (a.currency ?? "THB") === fromCurrency,
      ),
    [accounts, fromId, fromCurrency],
  );

  if (accounts.length < 2) {
    return (
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Lägg till ett till saldo under {SV.merPathSaldo} för att kunna flytta
        pengar mellan konton.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!guard.tryBegin()) return;
        setError(null);
        startTransition(async () => {
          let amountMinor: number;
          try {
            amountMinor = parseUiAmountToMinor(amount);
          } catch {
            setError("Ogiltigt belopp");
            return;
          }
          if (amountMinor <= 0) {
            setError("Beloppet måste vara större än 0");
            return;
          }
          if (!toId) {
            setError("Välj ett målkonto");
            return;
          }
          const toAccount = accounts.find((a) => a.id === toId);
          if (!toAccount) {
            setError("Kontot hittades inte");
            return;
          }
          if ((toAccount.currency ?? "THB") !== fromCurrency) {
            setError(
              "Överföring mellan olika valutor stöds inte ännu. Välj ett konto i samma valuta.",
            );
            return;
          }
          const result = await createTransferAction({
            fromAccountId: fromId,
            toAccountId: toId,
            amount,
            description: description || undefined,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          applyLocalTransfer({
            fromAccountId: fromId,
            toAccountId: toId,
            amountMinor,
          });
          confirmOptimisticFinance();
          setAmount("");
          setDescription("");
          onSuccess?.();
        });
      }}
    >
      <AccountSelect
        label="Från"
        value={fromId}
        onChange={(id) => {
          setFromId(id);
          const nextFrom = accounts.find((a) => a.id === id);
          const nextCurrency = nextFrom?.currency ?? "THB";
          const nextDest = accounts.filter(
            (a) => a.id !== id && (a.currency ?? "THB") === nextCurrency,
          );
          if (!nextDest.some((a) => a.id === toId)) {
            setToId(nextDest[0]?.id ?? "");
          }
          setError(null);
        }}
        accounts={accounts}
      />
      <AccountSelect
        label="Till"
        value={toId}
        onChange={setToId}
        accounts={compatibleDestinations}
      />
      {compatibleDestinations.length === 0 ? (
        <p className="text-sm text-[var(--numa-muted)]">
          Inga andra konton i {fromCurrency}. Överföring mellan olika valutor
          stöds inte ännu.
        </p>
      ) : null}
      <AmountField value={amount} onChange={setAmount} />
      <TextField
        value={description}
        onChange={setDescription}
        placeholder="Valfri notis"
      />
      <ErrorText error={error} />
      <Submit
        pending={pending}
        disabled={!amount.trim() || !toId || compatibleDestinations.length === 0}
        label="Flytta"
      />
    </form>
  );
}

function CashForm({
  primaryAccountId,
  accounts,
  onSuccess,
}: {
  primaryAccountId: string;
  accounts: ShellAccount[];
  onSuccess?: () => void;
}) {
  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === "cash"),
    [accounts],
  );
  const [fromId, setFromId] = useState(primaryAccountId);
  const [toId, setToId] = useState(cashAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);

  if (cashAccounts.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Skapa först ett saldo av typen Kontanter under {SV.merPathSaldo}. Annars
        försvinner uttaget i modellen.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!guard.tryBegin()) return;
        setError(null);
        startTransition(async () => {
          if (!toId) {
            setError("Välj ett kontantkonto");
            return;
          }
          let amountMinor: number;
          try {
            amountMinor = parseUiAmountToMinor(amount);
          } catch {
            setError("Ogiltigt belopp");
            return;
          }
          if (amountMinor <= 0) {
            setError("Beloppet måste vara större än 0");
            return;
          }
          const result = await createCashWithdrawalAction({
            fromAccountId: fromId,
            toAccountId: toId,
            amount,
            description: description || undefined,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          applyLocalTransfer({
            fromAccountId: fromId,
            toAccountId: toId,
            amountMinor,
          });
          confirmOptimisticFinance();
          setAmount("");
          setDescription("");
          onSuccess?.();
        });
      }}
    >
      <p className="text-sm text-[var(--numa-muted)]">
        Uttag från bank/konto. Räknas inte som shopping — bara att pengarna
        byter form.
      </p>
      <AccountSelect
        label="Från"
        value={fromId}
        onChange={(id) => {
          setFromId(id);
          if (id === toId) {
            const next = cashAccounts.find((a) => a.id !== id);
            if (next) setToId(next.id);
          }
        }}
        accounts={accounts.filter((a) => a.accountType !== "cash" || a.id !== toId)}
      />
      <AccountSelect
        label="Till kontanter"
        value={toId}
        onChange={setToId}
        accounts={cashAccounts.filter((a) => a.id !== fromId)}
      />
      <AmountField value={amount} onChange={setAmount} />
      <TextField
        value={description}
        onChange={setDescription}
        placeholder="t.ex. ATM"
      />
      <ErrorText error={error} />
      <Submit
        pending={pending}
        disabled={!amount.trim() || !toId}
        label="Spara uttag"
      />
    </form>
  );
}

function AmountField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
        Belopp
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="money w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-4 text-3xl font-semibold outline-none ring-[var(--numa-accent)] focus:ring-2"
        aria-label="Belopp"
      />
    </label>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-11 w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
    />
  );
}

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  accounts: ShellAccount[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-[var(--numa-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="text-sm text-[var(--numa-danger)]" role="alert">
      {error}
    </p>
  );
}

function Submit({
  pending,
  disabled,
  label,
}: {
  pending: boolean;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="numa-btn numa-btn-accent w-full"
    >
      {pending ? "Sparar…" : label}
    </button>
  );
}
