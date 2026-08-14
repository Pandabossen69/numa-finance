"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCashWithdrawalAction,
  createExpenseAction,
  createIncomeAction,
  createTransferAction,
} from "@/features/finance/actions";

export type ShellAccount = {
  id: string;
  name: string;
  accountType: string;
  currency?: string;
};

const CATEGORIES = ["Mat", "Transport", "Shopping", "Boende", "Övrigt"] as const;
const LAST_CATEGORY_KEY = "numa.lastExpenseCategory";

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
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const modes: Array<{ id: Mode; label: string }> = [
    { id: "expense", label: "Utgift" },
    { id: "income", label: "Inkomst" },
    { id: "transfer", label: "Flytta" },
    { id: "cash", label: "Kontant" },
  ];

  function handleSuccess(note: string) {
    setSavedNote(note);
    window.setTimeout(() => onSuccess?.(), 850);
  }

  return (
    <div className="space-y-4">
      {savedNote ? (
        <p
          className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-positive)_14%,transparent)] px-3 py-2.5 text-sm text-[var(--numa-positive)]"
          role="status"
        >
          {savedNote}
        </p>
      ) : null}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`min-h-11 shrink-0 rounded-xl px-3 text-sm transition ${
              mode === m.id
                ? "bg-[var(--numa-accent-soft)] font-medium text-[var(--numa-accent-ink)]"
                : "text-[var(--numa-muted)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "expense" ? (
        <ExpenseForm
          accountId={primaryAccountId}
          onSuccess={() => handleSuccess("Utgift sparad — dagens läge uppdateras.")}
        />
      ) : null}
      {mode === "income" ? (
        <IncomeForm
          accountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() => handleSuccess("Inkomst sparad — saldot ökar.")}
        />
      ) : null}
      {mode === "transfer" ? (
        <TransferForm
          primaryAccountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() => handleSuccess("Flytt sparad mellan dina saldon.")}
        />
      ) : null}
      {mode === "cash" ? (
        <CashForm
          primaryAccountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() => handleSuccess("Kontantuttag sparat.")}
        />
      ) : null}
    </div>
  );
}

function ExpenseForm({
  accountId,
  onSuccess,
}: {
  accountId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Mat");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_CATEGORY_KEY);
      if (saved && (CATEGORIES as readonly string[]).includes(saved)) {
        setCategory(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createExpenseAction({
            accountId,
            amount,
            category,
            description: description || undefined,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          try {
            localStorage.setItem(LAST_CATEGORY_KEY, category);
          } catch {
            // ignore
          }
          setAmount("");
          setDescription("");
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <AmountField value={amount} onChange={setAmount} />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`min-h-10 rounded-xl px-3 text-sm transition ${
              category === c
                ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                : "text-[var(--numa-muted)]"
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
  const router = useRouter();
  const [targetId, setTargetId] = useState(accountId);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createIncomeAction({
            accountId: targetId,
            amount,
            description: description || undefined,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onSuccess?.();
          router.refresh();
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
  const router = useRouter();
  const others = accounts.filter((a) => a.id !== primaryAccountId);
  const [fromId, setFromId] = useState(primaryAccountId);
  const [toId, setToId] = useState(others[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (accounts.length < 2) {
    return (
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Lägg till ett till saldo under Mer → Mina saldon för att kunna flytta
        pengar mellan konton.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
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
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <AccountSelect
        label="Från"
        value={fromId}
        onChange={(id) => {
          setFromId(id);
          if (id === toId) {
            const next = accounts.find((a) => a.id !== id);
            if (next) setToId(next.id);
          }
        }}
        accounts={accounts}
      />
      <AccountSelect
        label="Till"
        value={toId}
        onChange={setToId}
        accounts={accounts.filter((a) => a.id !== fromId)}
      />
      <AmountField value={amount} onChange={setAmount} />
      <TextField
        value={description}
        onChange={setDescription}
        placeholder="Valfri notis"
      />
      <ErrorText error={error} />
      <Submit
        pending={pending}
        disabled={!amount.trim() || !toId}
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
  const router = useRouter();
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

  if (cashAccounts.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Skapa först ett saldo av typen Kontanter under Mer → Mina saldon. Annars
        försvinner uttaget i modellen.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          if (!toId) {
            setError("Välj ett kontantkonto");
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
          onSuccess?.();
          router.refresh();
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
        className="money w-full rounded-2xl border border-[var(--numa-border)] bg-white/70 px-4 py-4 text-3xl font-semibold outline-none ring-[var(--numa-accent)] focus:ring-2"
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
      className="w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
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
        className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
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
      className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-medium text-white transition enabled:active:scale-[0.99] disabled:opacity-50"
    >
      {pending ? "Sparar…" : label}
    </button>
  );
}
