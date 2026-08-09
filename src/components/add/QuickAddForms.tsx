"use client";

import { useMemo, useState, useTransition } from "react";
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
};

const EXPENSE_CATEGORIES = [
  "Mat",
  "Café",
  "Transport",
  "Boende",
  "Räkning",
  "Hälsa",
  "Shopping",
  "Nöje",
  "Övrigt",
] as const;

const INCOME_PRESETS = ["Lön", "CSN", "Återbetalning", "Present", "Övrigt"] as const;

const LAST_CATEGORY_KEY = "numa.lastExpenseCategory";
const LAST_INCOME_KEY = "numa.lastIncomeName";

type Mode = "expense" | "income" | "transfer" | "cash";
type When = "today" | "yesterday";

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
  const modes: Array<{ id: Mode; label: string; hint: string }> = [
    { id: "expense", label: "Utgift", hint: "Köp & vardag" },
    { id: "income", label: "Inkomst", hint: "Pengar in" },
    { id: "transfer", label: "Flytta", hint: "Mellan konton" },
    { id: "cash", label: "Kontant", hint: "ATM / cash" },
  ];

  function handleSuccess(note: string) {
    setSavedNote(note);
    window.setTimeout(() => onSuccess?.(), 700);
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

      <div className="grid grid-cols-4 gap-1.5">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`min-h-[3.4rem] rounded-2xl px-1.5 py-2 text-center transition ${
              mode === m.id
                ? "bg-[var(--numa-accent)] text-white"
                : "border border-[var(--numa-border)] bg-[var(--numa-surface)] text-[var(--numa-ink)]"
            }`}
          >
            <span className="block text-[13px] font-semibold leading-tight">
              {m.label}
            </span>
            <span
              className={`mt-0.5 block text-[10px] leading-tight ${
                mode === m.id ? "text-white/80" : "text-[var(--numa-faint)]"
              }`}
            >
              {m.hint}
            </span>
          </button>
        ))}
      </div>

      {mode === "expense" ? (
        <ExpenseForm
          accountId={primaryAccountId}
          onSuccess={() =>
            handleSuccess("Utgift sparad — Idag och månaden uppdateras.")
          }
        />
      ) : null}
      {mode === "income" ? (
        <IncomeForm
          accountId={primaryAccountId}
          accounts={accounts}
          onSuccess={() =>
            handleSuccess("Inkomst sparad — saldot ökar.")
          }
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
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [category, setCategory] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LAST_CATEGORY_KEY);
      if (saved && (EXPENSE_CATEGORIES as readonly string[]).includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return "Mat";
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
          setError("Ge utgiften ett namn, t.ex. Lunch eller Grab");
          return;
        }
        startTransition(async () => {
          const result = await createExpenseAction({
            accountId,
            amount,
            category,
            description: name.trim(),
            when,
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
          setName("");
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <NameField
        label="Vad var det?"
        value={name}
        onChange={setName}
        placeholder="t.ex. Lunch, Grab, 7-Eleven"
        autoFocus
      />
      <AmountField value={amount} onChange={setAmount} />
      <WhenPicker value={when} onChange={setWhen} />
      <ChipRow
        label="Kategori"
        options={EXPENSE_CATEGORIES}
        value={category}
        onChange={setCategory}
      />
      <ErrorText error={error} />
      <Submit
        pending={pending}
        disabled={!amount.trim() || !name.trim()}
        label="Spara utgift"
      />
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
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(LAST_INCOME_KEY) ?? "Lön";
    } catch {
      return "Lön";
    }
  });
  const [targetId, setTargetId] = useState(accountId);
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
          setError("Ge inkomsten ett namn, t.ex. Lön eller CSN");
          return;
        }
        startTransition(async () => {
          const result = await createIncomeAction({
            accountId: targetId,
            amount,
            description: name.trim(),
            when,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          try {
            localStorage.setItem(LAST_INCOME_KEY, name.trim());
          } catch {
            // ignore
          }
          setAmount("");
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <ChipRow
        label="Vanliga inkomster"
        options={INCOME_PRESETS}
        value={
          (INCOME_PRESETS as readonly string[]).includes(name) ? name : "Övrigt"
        }
        onChange={(v) => setName(v === "Övrigt" ? "" : v)}
      />
      <NameField
        label="Namn på inkomsten"
        value={name}
        onChange={setName}
        placeholder="t.ex. Lön, CSN, återbetalning"
      />
      {accounts.length > 1 ? (
        <AccountSelect
          label="Till konto"
          value={targetId}
          onChange={setTargetId}
          accounts={accounts}
        />
      ) : null}
      <AmountField value={amount} onChange={setAmount} />
      <WhenPicker value={when} onChange={setWhen} />
      <ErrorText error={error} />
      <Submit
        pending={pending}
        disabled={!amount.trim() || !name.trim()}
        label="Spara inkomst"
      />
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
  const [name, setName] = useState("Överföring");
  const [when, setWhen] = useState<When>("today");
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
            description: name.trim() || "Överföring",
            when,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setAmount("");
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <NameField
        label="Vad kallar du flytten?"
        value={name}
        onChange={setName}
        placeholder="t.ex. Till sparande"
      />
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
      <WhenPicker value={when} onChange={setWhen} />
      <ErrorText error={error} />
      <Submit
        pending={pending}
        disabled={!amount.trim() || !toId}
        label="Spara flytt"
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
  const [name, setName] = useState("Kontantuttag");
  const [when, setWhen] = useState<When>("today");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createCashWithdrawalAction({
            fromAccountId: fromId,
            toAccountId: toId || null,
            amount,
            description: name.trim() || "Kontantuttag",
            when,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setAmount("");
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-[var(--numa-muted)]">
        Uttag från bank. Räknas inte som shopping — pengarna byter bara form.
      </p>
      <NameField
        label="Namn"
        value={name}
        onChange={setName}
        placeholder="t.ex. ATM Bangkok Bank"
      />
      <AccountSelect
        label="Från"
        value={fromId}
        onChange={setFromId}
        accounts={accounts}
      />
      {cashAccounts.length > 0 ? (
        <AccountSelect
          label="Till kontanter"
          value={toId}
          onChange={setToId}
          accounts={cashAccounts}
        />
      ) : (
        <p className="text-xs text-[var(--numa-faint)]">
          Tips: skapa ett saldo av typen Kontanter under Mina saldon om du vill
          följa plånboken också.
        </p>
      )}
      <AmountField value={amount} onChange={setAmount} />
      <WhenPicker value={when} onChange={setWhen} />
      <ErrorText error={error} />
      <Submit pending={pending} disabled={!amount.trim()} label="Spara uttag" />
    </form>
  );
}

function NameField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="min-h-14 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] font-medium text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
      />
    </label>
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
        Hur mycket?
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="money min-h-16 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-3xl font-semibold text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        aria-label="Belopp"
      />
    </label>
  );
}

function WhenPicker({
  value,
  onChange,
}: {
  value: When;
  onChange: (v: When) => void;
}) {
  return (
    <div className="flex gap-2">
      {(
        [
          { id: "today", label: "Idag" },
          { id: "yesterday", label: "Igår" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`min-h-10 flex-1 rounded-xl text-sm font-medium transition ${
            value === opt.id
              ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
              : "border border-[var(--numa-border)] text-[var(--numa-muted)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`min-h-10 rounded-xl px-3 text-sm transition ${
              value === c
                ? "bg-[var(--numa-accent-soft)] font-medium text-[var(--numa-accent-ink)]"
                : "border border-[var(--numa-border)] text-[var(--numa-muted)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
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
        className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-sm text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
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
      className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-[15px] font-semibold text-white transition enabled:active:scale-[0.99] disabled:opacity-50"
    >
      {pending ? "Sparar…" : label}
    </button>
  );
}
