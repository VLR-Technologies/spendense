"use client";
import { profileDisplayName } from "@/lib/branding";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { animate, useReducedMotion } from "motion/react";
import {
  Plus,
  ArrowRight,
  Wallet,
  Check,
  CalendarDays,
  Repeat2,
} from "lucide-react";
import { useApp } from "./provider";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import {
  money,
  preciseMoney,
  toMinor,
  summarize,
  allocate,
} from "@/lib/finance";
import { monthLabel, today, dateAt, daysInMonth } from "@/lib/dates";
import { dailyCategories, commitmentCategories } from "@/lib/categories";
import type { DailyExpense, MonthlyCommitment } from "@/types";

export function AnimatedMoney({
  value,
  exact = false,
}: {
  value: number;
  exact?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = exact ? preciseMoney(value) : money(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.4,
      onUpdate: (v) => {
        el.textContent = exact
          ? preciseMoney(Math.round(v))
          : money(Math.round(v));
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, exact, reduced]);
  return <span ref={ref}>{exact ? preciseMoney(value) : money(value)}</span>;
}
export function IncomeForm({
  onDone,
  onboarding = false,
}: {
  onDone?: () => void;
  onboarding?: boolean;
}) {
  const { repository, profileId, month, data, act } = useApp();
  const [amount, setAmount] = useState(
    String((data?.plan.monthlyIncomeMinor ?? 0) / 100),
  );
  const [scope, setScope] = useState<"month" | "default">(
    onboarding ? "default" : "month",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const minor = (() => {
    try {
      return toMinor(amount);
    } catch {
      return 0;
    }
  })();
  const fixed = data ? summarize(data).fixed : 0;
  const allowance = allocate(minor - fixed, daysInMonth(month))[0];
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    let value: number;
    try {
      value = toMinor(amount);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    if (
      await act(
        () => repository.saveIncome(profileId, month, value, scope),
        "Income plan saved",
      )
    )
      onDone?.();
    setBusy(false);
  }
  return (
    <form onSubmit={save} className="income-form">
      <div className="amount-heading">
        <span className="eyebrow">YOUR MONTHLY INCOME</span>
        <div className="income-number">
          <AnimatedMoney value={minor} />
        </div>
        <span className="muted">A little clarity goes a long way.</span>
      </div>
      <label htmlFor="income-slider" className="sr-only">
        Monthly income slider
      </label>
      <input
        id="income-slider"
        className="income-slider"
        type="range"
        min="0"
        max="500000"
        step="1000"
        value={Math.min(Number(amount) || 0, 500000)}
        onChange={(e) => {
          setAmount(e.target.value);
          setError("");
        }}
      />
      <div className="range-labels">
        <span>₹0</span>
        <span>₹2,50,000</span>
        <span>₹5,00,000</span>
      </div>
      <label className="field">
        Or enter an exact amount, in INR
        <div className="input-prefix">
          <span>₹</span>
          <input
            aria-label="Monthly income amount"
            type="number"
            min="0"
            max="1000000000"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError("");
            }}
            required
          />
        </div>
      </label>
      <label className="field">
        Apply this income
        <select
          aria-label="Apply this income"
          value={scope}
          onChange={(e) => setScope(e.target.value as typeof scope)}
        >
          <option value="month">
            Only {monthLabel(month)} (month override)
          </option>
          <option value="default">
            Default from {monthLabel(month)} onward
          </option>
        </select>
      </label>
      <div className="preview-budget">
        <div>
          <span>Daily spending allowance</span>
          <small>
            After commitments · {daysInMonth(month)} days this month
          </small>
        </div>
        <strong className={allowance < 0 ? "negative" : ""}>
          <AnimatedMoney value={allowance} exact />
        </strong>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {!onboarding && (
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              if (
                profileId &&
                (await act(
                  () => repository.saveIncome(profileId, month, 0, "reset"),
                  "Month reset to default income",
                ))
              )
                onDone?.();
            }}
          >
            Reset to default
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : onboarding ? "Continue" : "Save income"}
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
}

export function ExpenseForm({
  initial,
  date,
  onDone,
}: {
  initial?: DailyExpense;
  date?: string;
  onDone: () => void;
}) {
  const { repository, profileId, month, act } = useApp();
  const { categories } = useApp();
  const custom = categories.filter((c) => c.type === "daily");
  const [amount, setAmount] = useState(
    initial ? String(initial.amountMinor / 100) : "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Food");
  const [expenseDate, setDate] = useState(
    initial?.date ??
      date ??
      (today().startsWith(month) ? today() : dateAt(month, 1)),
  );
  const [time, setTime] = useState(initial?.time ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    setError("");
    let value: number;
    try {
      value = toMinor(amount);
      if (!value) throw new Error("Enter an amount greater than zero.");
      if (category === "__custom" && !customName.trim())
        throw new Error("Enter a category name.");
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    const success = await act(
      async () => {
        const cat = category === "__custom" ? customName.trim() : category;
        if (category === "__custom")
          await repository.addCategory(profileId, cat);
        await repository.saveExpense({
          id: initial?.id ?? crypto.randomUUID(),
          profileId,
          date: expenseDate,
          amountMinor: value,
          description,
          category: cat,
          time: time || undefined,
          notes,
          createdAt: initial?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      },
      initial
        ? "Expense updated"
        : "Expense added. Every little bit, accounted for.",
    );
    setBusy(false);
    if (success) onDone();
  }
  return (
    <form onSubmit={save} className="stack-form">
      <label className="field expense-amount-label">
        Amount, in INR
        <div className="expense-amount">
          <span>₹</span>
          <input
            aria-label="Expense amount"
            autoFocus
            type="number"
            min="0.01"
            max="1000000000"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </label>
      <div className="quick-amounts">
        {[50, 100, 200, 500].map((n) => (
          <button type="button" key={n} onClick={() => setAmount(String(n))}>
            ₹{n}
          </button>
        ))}
      </div>
      <label className="field">
        What was it for?
        <input
          maxLength={100}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Coffee with a friend"
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Category
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              ...new Set([
                ...dailyCategories,
                ...custom.map((c) => c.name),
                ...(initial ? [initial.category] : []),
              ]),
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
            <option value="__custom">+ Create category</option>
          </select>
        </label>
        <label className="field">
          Date
          <input
            aria-label="Expense date"
            type="date"
            min="1900-01-01"
            max="2200-12-31"
            value={expenseDate}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>
      {category === "__custom" && (
        <label className="field">
          New category name
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={60}
            required
          />
        </label>
      )}
      <details className="optional-fields">
        <summary>
          Time & notes <span>Optional</span>
        </summary>
        <label className="field">
          Time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="field">
          Notes
          <textarea
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you’d like to remember"
          />
        </label>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          <Check size={16} />
          {busy ? "Saving…" : initial ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}

export function CommitmentForm({
  initial,
  onDone,
  defaultCategory,
}: {
  initial?: MonthlyCommitment;
  onDone: () => void;
  defaultCategory?: string;
}) {
  const { repository, profileId, month, data, act } = useApp();
  const prior = data?.recurring
    .filter(
      (r) => r.sourceId === initial?.sourceId && r.effectiveMonth <= month,
    )
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(
    initial ? String(initial.amountMinor / 100) : "",
  );
  const [category, setCategory] = useState(
    initial?.category ?? defaultCategory ?? "Room Rent",
  );
  const [origin, setOrigin] = useState(initial?.origin ?? "recurring");
  const [scope, setScope] = useState<"month" | "future">(
    initial?.sourceId && prior?.active ? "month" : "future",
  );
  const [paymentDay, setPaymentDay] = useState(
    String(initial?.paymentDay ?? ""),
  );
  const [startMonth, setStartMonth] = useState(prior?.startMonth ?? month);
  const [endMonth, setEndMonth] = useState(prior?.endMonth ?? "");
  const [active, setActive] = useState(prior?.active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    let value: number;
    try {
      value = toMinor(amount);
      if (!value) throw new Error("Enter an amount greater than zero.");
      if (endMonth && endMonth < startMonth)
        throw new Error("End month must be on or after the start month.");
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    const ok = await act(
      () =>
        repository.saveCommitment(
          {
            id: initial?.id ?? crypto.randomUUID(),
            profileId,
            yearMonth: month,
            sourceId: initial?.sourceId,
            name,
            category,
            amountMinor: value,
            origin,
            paid: initial?.paid ?? false,
            paymentDay: paymentDay ? Number(paymentDay) : undefined,
            notes,
          },
          origin === "one-time" ? "month" : scope,
          { startMonth, endMonth: endMonth || undefined, active },
        ),
      "Monthly commitment saved",
    );
    setBusy(false);
    if (ok) onDone();
  }
  return (
    <form onSubmit={save} className="stack-form">
      <div className="segmented">
        <button
          type="button"
          className={origin === "recurring" ? "active" : ""}
          onClick={() => {
            setOrigin("recurring");
            if (!initial?.sourceId) setScope("future");
          }}
        >
          <Repeat2 size={15} />
          Recurring monthly
        </button>
        <button
          type="button"
          disabled={!!initial?.sourceId}
          className={origin === "one-time" ? "active" : ""}
          onClick={() => setOrigin("one-time")}
        >
          <CalendarDays size={15} />
          One-time this month
        </button>
      </div>
      <label className="field">
        Expense name
        <input
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Room rent or family support"
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Amount (INR)
          <div className="input-prefix">
            <span>₹</span>
            <input
              aria-label="Commitment amount"
              type="number"
              min="0.01"
              max="1000000000"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          Currency
          <select aria-label="Commitment currency">
            <option>INR — Indian Rupee</option>
          </select>
        </label>
      </div>
      <label className="field">
        Category
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {commitmentCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {origin === "recurring" && (
        <>
          <label className="field">
            Apply changes
            <select
              aria-label="Apply changes"
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              <option value="future">
                {monthLabel(month)} and subsequent months
              </option>
              {initial?.sourceId && (
                <option value="month">Only {monthLabel(month)}</option>
              )}
            </select>
          </label>
          {scope === "future" && (
            <>
              <div className="form-grid">
                <label className="field">
                  Starts
                  <input
                    type="month"
                    min="1900-01"
                    max="2200-12"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  Ends (optional)
                  <input
                    type="month"
                    min={startMonth}
                    max="2200-12"
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                  />
                </label>
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Active from {monthLabel(month)}
              </label>
            </>
          )}
        </>
      )}
      <div className="form-grid">
        <label className="field">
          Payment day (optional)
          <input
            type="number"
            min="1"
            max="31"
            placeholder="e.g. 5"
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
          />
        </label>
        <div className="field">
          <span>Billing frequency</span>
          <div className="readonly-field">
            {origin === "recurring" ? "Monthly" : "Once, this month"}
          </div>
        </div>
      </div>
      <label className="field">
        Notes (optional)
        <textarea
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>
      <p className="hint">
        Payment dates are reminders. Marking a bill paid never deducts it twice.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="ghost" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={busy} type="submit">
          <Check size={16} />
          {busy ? "Saving…" : "Save commitment"}
        </Button>
      </div>
    </form>
  );
}

export function ProfileDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { repository, mode, profiles, selectProfile, act } = useApp();
  const [name, setName] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your little financial worlds"
      description={
        mode === "cloud"
          ? "Separate profiles in your cloud account."
          : "Separate local profiles. Stored only in this browser."
      }
    >
      <div className="profile-list">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              selectProfile(p.id);
              onClose();
            }}
          >
            <span className="avatar">{profileDisplayName(p)[0]}</span>
            <span>
              <strong>{profileDisplayName(p)}</strong>
              <small>
                {mode === "cloud"
                  ? "Cloud profile · your account"
                  : p.demo
                    ? "Sample data · demo profile"
                    : "Local profile · this device"}
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await act(async () => {
            const p = await repository.createProfile(name);
            selectProfile(p.id);
            setName("");
            onClose();
          }, "Your new profile is ready");
        }}
      >
        <label className="field">
          Create a new profile
          <input
            required
            maxLength={50}
            placeholder="e.g. Family budget"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button type="submit">
          <Plus size={16} />
          {mode === "cloud" ? "Create cloud profile" : "Create local profile"}
        </Button>
      </form>
    </Dialog>
  );
}
export function EmptyState({
  icon = <Wallet size={24} />,
  title,
  description,
  action,
  label,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && (
        <Button size="sm" variant="secondary" onClick={action}>
          <Plus size={15} />
          {label ?? "Get started"}
        </Button>
      )}
    </div>
  );
}
