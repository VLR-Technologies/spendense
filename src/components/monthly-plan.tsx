"use client";
import { useState } from "react";
import {
  Home,
  HeartPulse,
  Receipt,
  Zap,
  Droplets,
  Wifi,
  Smartphone,
  TrainFront,
  CreditCard,
  Repeat2,
  GraduationCap,
  CirclePlus,
  Plus,
  Pencil,
  Trash2,
  Check,
  Pause,
  Wallet,
  CalendarDays,
  Info,
} from "lucide-react";
import { useApp } from "./provider";
import { summarize, money, preciseMoney } from "@/lib/finance";
import { monthLabel } from "@/lib/dates";
import { commitmentCategories } from "@/lib/categories";
import { CommitmentForm, IncomeForm, EmptyState } from "./forms";
import { PageLoading } from "./calendar";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import type { MonthlyCommitment, RecurringRevision } from "@/types";
const icons = [
  Home,
  HeartPulse,
  Receipt,
  Zap,
  Droplets,
  Wifi,
  Smartphone,
  TrainFront,
  CreditCard,
  Repeat2,
  GraduationCap,
  CirclePlus,
];
export function CommitmentIcon({ category }: { category: string }) {
  const Icon = icons[commitmentCategories.indexOf(category)] ?? CirclePlus;
  return (
    <span className="commitment-icon">
      <Icon size={20} />
    </span>
  );
}
export function MonthlyPlanPage() {
  const { repository, data, month, profileId, act } = useApp();
  const [income, setIncome] = useState(false);
  const [form, setForm] = useState<{
    initial?: MonthlyCommitment;
    category?: string;
  } | null>(null);
  const [remove, setRemove] = useState<MonthlyCommitment | null>(null);
  const [removeFuture, setRemoveFuture] = useState(false);
  if (!data) return <PageLoading />;
  const s = summarize(data);
  const recurring = data.commitments.filter((c) => c.origin === "recurring");
  const oneTime = data.commitments.filter((c) => c.origin === "one-time");
  const latest = new Map<string, RecurringRevision>();
  data.recurring
    .filter((r) => r.effectiveMonth <= month)
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
    .forEach((r) => latest.set(r.sourceId, r));
  const other = [...latest.values()].filter(
    (r) => !recurring.some((c) => c.sourceId === r.sourceId),
  );
  function row(c: MonthlyCommitment) {
    return (
      <div className="commitment-row" key={c.id}>
        <CommitmentIcon category={c.category} />
        <div className="commitment-name">
          <strong>{c.name}</strong>
          <span>
            {c.category}
            {c.paymentDay ? ` · Expected day ${c.paymentDay}` : ""}
          </span>
          {c.notes && <small>{c.notes}</small>}
        </div>
        <span
          className={`commitment-type ${c.origin === "recurring" ? "" : "one-time"}`}
        >
          {c.origin === "recurring" ? (
            <Repeat2 size={12} />
          ) : (
            <CalendarDays size={12} />
          )}
          {c.origin === "recurring" ? "Monthly" : "One-time"}
        </span>
        <strong className="commitment-amount">
          {preciseMoney(c.amountMinor)}
        </strong>
        <button
          className={`paid-toggle ${c.paid ? "paid" : ""}`}
          onClick={() =>
            act(
              () => repository.markPaid(c),
              c.paid
                ? "Marked as unpaid"
                : "Marked paid. Your budget stays the same.",
            )
          }
          aria-label={`Mark ${c.name} ${c.paid ? "unpaid" : "paid"}`}
        >
          <Check size={13} />
          {c.paid ? "Paid" : "Mark paid"}
        </button>
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label={`Edit ${c.name}`}
            onClick={() => setForm({ initial: c })}
          >
            <Pencil size={15} />
          </button>
          {c.sourceId && (
            <button
              className="icon-button"
              aria-label={`Pause ${c.name} from this month`}
              onClick={() => {
                setRemove(c);
                setRemoveFuture(true);
              }}
            >
              <Pause size={15} />
            </button>
          )}
          <button
            className="icon-button delete-action"
            aria-label={`Remove ${c.name}`}
            onClick={() => {
              setRemove(c);
              setRemoveFuture(false);
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A PLAN THAT MAKES ROOM FOR LIFE</span>
          <h1>
            The essentials, accounted for<span className="heading-dot">.</span>
          </h1>
          <p>
            Give your month a starting point. We’ll take care of the daily
            picture.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setForm({})}>
          <Plus size={16} />
          Add monthly expense
        </Button>
      </div>
      <div className="plan-flow">
        <button onClick={() => setIncome(true)} className="plan-flow-item">
          <span className="summary-icon purple">
            <Wallet size={20} />
          </span>
          <span>
            Monthly income<strong>{money(s.income)}</strong>
            <small>
              {data.plan.incomeOverride
                ? "Month override"
                : "From your default income"}
            </small>
          </span>
          <Pencil size={15} />
        </button>
        <span className="flow-minus">−</span>
        <div className="plan-flow-item">
          <span className="summary-icon amber">
            <Receipt size={20} />
          </span>
          <span>
            Monthly commitments<strong>{money(s.fixed)}</strong>
            <small>{data.commitments.length} expenses this month</small>
          </span>
        </div>
        <span className="flow-equals">=</span>
        <div className="plan-flow-item net-flow">
          <span>
            Available monthly budget
            <strong className={s.spendable < 0 ? "negative" : ""}>
              {money(s.spendable)}
            </strong>
            <small>
              {preciseMoney(s.averageAllowance)} daily · {s.days.length} days
            </small>
          </span>
        </div>
      </div>
      <section className="panel commitments-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <Repeat2 size={18} />
              Monthly commitments{" "}
              <span className="count-badge">{recurring.length}</span>
            </h2>
            <p>The regulars. They’ll carry forward automatically.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setForm({})}>
            <Plus size={15} />
            Add custom monthly expense
          </Button>
        </div>
        {recurring.length ? (
          recurring.map(row)
        ) : (
          <EmptyState
            title="Make space for the essentials"
            description="Rent, bills, subscriptions — add only what’s part of your life."
            action={() => setForm({})}
            label="Add a commitment"
          />
        )}
      </section>
      <section className="panel commitments-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <CalendarDays size={18} />
              Just for {monthLabel(month).split(" ")[0]}{" "}
              <span className="count-badge">{oneTime.length}</span>
            </h2>
            <p>One-time commitments. They won’t carry into next month.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setForm({
                initial: {
                  id: crypto.randomUUID(),
                  profileId: profileId!,
                  yearMonth: month,
                  name: "",
                  category: "Other Mandatory Expense",
                  amountMinor: 0,
                  origin: "one-time",
                  paid: false,
                  notes: "",
                },
              })
            }
          >
            <Plus size={15} />
            Add one-time expense
          </Button>
        </div>
        {oneTime.length ? (
          oneTime.map(row)
        ) : (
          <div className="inline-empty">
            <span>No one-time commitments this month.</span>
            <span>
              A repair, a registration, a little extra — give it a place here.
            </span>
          </div>
        )}
      </section>
      {other.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Paused & scheduled</h2>
              <p>These commitments aren’t allocated to this month.</p>
            </div>
          </div>
          {other.map((r) => (
            <div className="commitment-row" key={r.id}>
              <CommitmentIcon category={r.category} />
              <div className="commitment-name">
                <strong>{r.name}</strong>
                <span>
                  {!r.active
                    ? "Paused"
                    : r.startMonth > month
                      ? `Starts ${monthLabel(r.startMonth)}`
                      : r.endMonth && r.endMonth < month
                        ? "Schedule ended"
                        : "Excluded this month"}
                </span>
              </div>
              <strong>{money(r.amountMinor)}</strong>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setForm({
                    initial: {
                      id: crypto.randomUUID(),
                      profileId: r.profileId,
                      yearMonth: month,
                      sourceId: r.sourceId,
                      name: r.name,
                      category: r.category,
                      amountMinor: r.amountMinor,
                      origin: "recurring",
                      paid: false,
                      notes: r.notes,
                      paymentDay: r.paymentDay,
                    },
                  })
                }
              >
                <Pencil size={14} />
                Edit schedule
              </Button>
            </div>
          ))}
        </section>
      )}
      <section className="category-suggestions">
        <span className="eyebrow">THE USUAL ESSENTIALS</span>
        <h3>A little inspiration for your plan.</h3>
        <div>
          {commitmentCategories.map((c, i) => {
            const Icon = icons[i];
            return (
              <button key={c} onClick={() => setForm({ category: c })}>
                <Icon size={17} />
                {c}
                <Plus size={13} />
              </button>
            );
          })}
        </div>
      </section>
      <div className="info-note">
        <Info size={17} />
        <p>
          Commitments are spread across the month for budgeting. Payment status
          is a reminder, and never deducts the same bill twice. Earlier months
          remain unchanged when future defaults change.
        </p>
      </div>
      <Dialog
        open={income}
        onClose={() => setIncome(false)}
        title="Your monthly starting point"
        description={monthLabel(month)}
      >
        <IncomeForm onDone={() => setIncome(false)} />
      </Dialog>
      <Dialog
        open={!!form}
        onClose={() => setForm(null)}
        title={
          form?.initial?.name
            ? "A little change to your plan"
            : "Make room for a commitment"
        }
        description={monthLabel(month)}
      >
        {form && (
          <CommitmentForm
            key={form.initial?.id ?? form.category ?? "new"}
            initial={form.initial}
            defaultCategory={form.category}
            onDone={() => setForm(null)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title={
          removeFuture ? "Pause this commitment?" : "Remove this commitment?"
        }
        description="Choose how this change applies to your plan."
      >
        <p className="confirm-copy">
          {remove?.name} · {money(remove?.amountMinor ?? 0)}
        </p>
        {remove?.sourceId && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={removeFuture}
              onChange={(e) => setRemoveFuture(e.target.checked)}
            />
            Pause from {monthLabel(month)} onward
          </label>
        )}
        <p className="hint">
          {removeFuture
            ? "This month and subsequent plans will stop allocating this bill. Earlier months stay unchanged. You can resume it from Paused & scheduled."
            : "Only this month’s allocation will be removed. Recurring defaults stay unchanged."}
        </p>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setRemove(null)}>
            Keep commitment
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (
                remove &&
                (await act(
                  () => repository.removeCommitment(remove, removeFuture),
                  "Monthly plan updated",
                ))
              )
                setRemove(null);
            }}
          >
            {removeFuture ? "Pause commitment" : "Remove this month"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
