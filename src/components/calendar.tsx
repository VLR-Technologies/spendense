"use client";
import { useState, useRef } from "react";
import { parseISO, getDay } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Pencil,
  Trash2,
  Coffee,
  Utensils,
  ShoppingBag,
  TrainFront,
  HeartPulse,
  Gift,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { useApp } from "./provider";
import { summarize, preciseMoney, money, compactMoney } from "@/lib/finance";
import { monthLabel, dayLabel, today, dateAt } from "@/lib/dates";
import type { DaySummary, DailyExpense } from "@/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { ExpenseForm, EmptyState } from "./forms";
import { DailyBudgetBreakdown } from "./budget-breakdown";

export function CategoryIcon({
  category,
  size = 18,
}: {
  category: string;
  size?: number;
}) {
  const Icon =
    category === "Coffee"
      ? Coffee
      : ["Food", "Groceries"].includes(category)
        ? Utensils
        : ["Shopping", "Personal care"].includes(category)
          ? ShoppingBag
          : ["Public transport", "Fuel", "Travel"].includes(category)
            ? TrainFront
            : category === "Healthcare"
              ? HeartPulse
              : category === "Gifts"
                ? Gift
                : Wallet;
  return (
    <span
      className={`category-icon cat-${category === "Coffee" ? "amber" : category === "Food" ? "coral" : category === "Public transport" ? "blue" : "purple"}`}
    >
      <Icon size={size} />
    </span>
  );
}
export function ExpenseRows({
  expenses,
  showDate = false,
  compact = false,
}: {
  expenses: DailyExpense[];
  showDate?: boolean;
  compact?: boolean;
}) {
  const { repository, profileId, act } = useApp();
  const [edit, setEdit] = useState<DailyExpense | null>(null);
  const [remove, setRemove] = useState<DailyExpense | null>(null);
  return (
    <>
      <div className={`expense-rows ${compact ? "compact" : ""}`}>
        {expenses.map((e) => (
          <div className="expense-row" key={e.id}>
            <CategoryIcon category={e.category} />
            <button
              className="expense-description"
              onClick={() => setEdit(e)}
              title="Edit expense"
            >
              <strong>{e.description}</strong>
              <span>
                {e.category}
                {showDate && ` · ${dayLabel(e.date).split(", ")[1]}`}
                {e.time && ` · ${e.time}`}
              </span>
            </button>
            <strong className="expense-value">
              {preciseMoney(e.amountMinor)}
            </strong>
            <div className="expense-row-actions">
              <button
                className="icon-button"
                aria-label={`Edit ${e.description}`}
                onClick={() => setEdit(e)}
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-button delete-action"
                aria-label={`Delete ${e.description}`}
                onClick={() => setRemove(e)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title="Edit expense">
        {edit && (
          <ExpenseForm
            key={edit.id}
            initial={edit}
            onDone={() => setEdit(null)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Remove this expense?"
        description="Your calendar and budget will recalculate immediately."
      >
        <p className="confirm-copy">
          {remove?.description} · {money(remove?.amountMinor ?? 0)}
        </p>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setRemove(null)}>
            Keep expense
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (
                remove &&
                profileId &&
                (await act(
                  () => repository.deleteExpense(profileId, remove.id),
                  "Expense removed",
                ))
              )
                setRemove(null);
            }}
          >
            Remove expense
          </Button>
        </div>
      </Dialog>
    </>
  );
}
export function CalendarGrid({
  days,
  compact = false,
  onSelect,
  selected,
}: {
  days: DaySummary[];
  compact?: boolean;
  onSelect: (date: string) => void;
  selected?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedDate, setFocusedDate] = useState<string | undefined>();
  if (!days.length) return null;
  const tabDate = days.some((d) => d.date === focusedDate)
    ? focusedDate
    : days.some((d) => d.date === selected)
      ? selected
      : (days.find((d) => d.date === today())?.date ?? days[0].date);
  const offset = (getDay(parseISO(days[0].date)) + 6) % 7;
  const blanks = Array.from({ length: offset });
  return (
    <div
      className={`calendar-grid ${compact ? "calendar-compact" : ""}`}
      ref={gridRef}
    >
      <div className="calendar-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-dates">
        {blanks.map((_, i) => (
          <div className="calendar-blank" key={`blank-${i}`} />
        ))}
        {days.map((d, i) => {
          const isToday = d.date === today();
          const status = d.future
            ? "future"
            : d.remaining < 0
              ? "over"
              : d.spent > 0 && d.remaining <= d.allowance * 0.2
                ? "near"
                : "positive";
          return (
            <button
              type="button"
              data-date={d.date}
              key={d.date}
              aria-label={`${dayLabel(d.date)}. Allowance ${preciseMoney(d.allowance)}, spent ${preciseMoney(d.spent)}, ${d.future ? "projected remaining" : "remaining"} ${preciseMoney(d.remaining)}${d.remaining < 0 ? ". Over budget" : ""}`}
              aria-pressed={selected === d.date}
              aria-current={isToday ? "date" : undefined}
              tabIndex={d.date === tabDate ? 0 : -1}
              onFocus={() => setFocusedDate(d.date)}
              className={`calendar-day ${status} ${isToday ? "today" : ""} ${selected === d.date ? "selected" : ""}`}
              onClick={() => onSelect(d.date)}
              onKeyDown={(e) => {
                const delta = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                  Home: -((offset + i) % 7),
                  End: 6 - ((offset + i) % 7),
                }[e.key];
                if (delta !== undefined) {
                  e.preventDefault();
                  const target =
                    days[Math.max(0, Math.min(days.length - 1, i + delta))];
                  gridRef.current
                    ?.querySelector<HTMLButtonElement>(
                      `[data-date="${target.date}"]`,
                    )
                    ?.focus();
                }
              }}
            >
              <div className="calendar-day-top">
                <span>{d.day}</span>
                {isToday ? (
                  <small>Today</small>
                ) : d.remaining < 0 && !d.future ? (
                  <ArrowUpRight size={12} />
                ) : d.future ? (
                  <span className="projected-mark" aria-hidden="true">
                    ·
                  </span>
                ) : d.spent > 0 ? (
                  <span className="day-dot" />
                ) : null}
              </div>
              {!compact && (
                <>
                  <div className="cell-allowance">
                    <span>Allowance</span>
                    <b>{money(d.allowance)}</b>
                  </div>
                  <div className="cell-spent">
                    <span>Spent</span>
                    <b>
                      <span className="cell-amount-full">
                        {d.spent ? money(d.spent) : "—"}
                      </span>
                      <span className="cell-amount-short">
                        {d.spent ? compactMoney(d.spent) : "—"}
                      </span>
                    </b>
                  </div>
                </>
              )}
              <strong className="cell-remaining">
                <span className="cell-amount-full">
                  {preciseMoney(d.remaining)}
                </span>
                <span className="cell-amount-short">
                  {compactMoney(d.remaining)}
                </span>
              </strong>
              {!compact && (
                <span className="cell-label">
                  {d.future
                    ? "Projected"
                    : d.remaining < 0
                      ? "Over budget"
                      : isToday
                        ? "Remaining today"
                        : "Unspent"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function DayDrawer({
  date,
  onClose,
  onDateChange,
}: {
  date: string | null;
  onClose: () => void;
  onDateChange: (date: string) => void;
}) {
  const { data, month } = useApp();
  const [add, setAdd] = useState(false);
  const day = data
    ? summarize(data).days.find((d) => d.date === date)
    : undefined;
  const dayIndex = day?.day ?? 1;
  return (
    <>
      <Dialog
        open={!!date && !!day}
        onClose={onClose}
        title={day ? dayLabel(day.date) : "Day details"}
        description="Daily budget · INR"
        drawer
      >
        {day && (
          <>
            <div className="drawer-date-nav">
              <Button
                variant="ghost"
                size="sm"
                disabled={dayIndex === 1}
                onClick={() => onDateChange(dateAt(month, dayIndex - 1))}
              >
                <ChevronLeft size={16} />
                Previous day
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={dayIndex === (data ? summarize(data).days.length : 0)}
                onClick={() => onDateChange(dateAt(month, dayIndex + 1))}
              >
                Next day
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className={`day-balance ${day.remaining < 0 ? "over" : ""}`}>
              <span>
                {day.future
                  ? "Projected remaining"
                  : day.date === today()
                    ? "Remaining today"
                    : "Remaining amount"}
              </span>
              <strong>{preciseMoney(day.remaining)}</strong>
              <p>
                {day.future
                  ? "Future allowance, not realized savings."
                  : day.remaining < 0
                    ? "Recorded spending exceeds this day’s allowance."
                    : "Daily allowance − recorded daily expenses."}
              </p>
            </div>
            <DailyBudgetBreakdown day={day} />
            <div className="panel-heading">
              <h3>
                Daily expenses{" "}
                <span className="count-badge">{day.expenses.length}</span>
              </h3>
            </div>
            {day.expenses.length ? (
              <ExpenseRows expenses={day.expenses} />
            ) : (
              <EmptyState
                title="No expenses for this day"
                description="Add an expense to update this day’s remaining amount."
                icon={<CalendarDays size={23} />}
              />
            )}
            <div className="drawer-add-action">
              <Button className="full-width" onClick={() => setAdd(true)}>
                <Plus size={17} />
                Add an expense to this day
              </Button>
            </div>
            <p className="drawer-footnote">
              Fixed costs are already allocated. Marking a bill paid won’t
              reduce your allowance again.
            </p>
          </>
        )}
      </Dialog>
      <Dialog
        open={add && !!day}
        onClose={() => setAdd(false)}
        title="Add a daily expense"
        description={date ? dayLabel(date) : undefined}
      >
        <ExpenseForm
          key={date}
          date={date ?? undefined}
          onDone={() => setAdd(false)}
        />
      </Dialog>
    </>
  );
}
export function CalendarPage() {
  const { data, month } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  if (!data) return <PageLoading />;
  const summary = summarize(data);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Calendar</h1>
          <p>Daily allowance − daily expenses = remaining amount.</p>
        </div>
        <div className="heading-stat">
          <span>Daily allowance · average</span>
          <strong>{preciseMoney(summary.averageAllowance)}</strong>
        </div>
      </div>
      <section className="panel full-calendar">
        <div className="panel-heading">
          <div>
            <h2>{monthLabel(month)}</h2>
            <p>Remaining allowance by day. Select for exact amounts.</p>
          </div>
          <div className="calendar-key">
            <span>
              <i className="positive-key" />
              Within budget
            </span>
            <span>
              <ArrowUpRight size={13} aria-hidden="true" />
              Over budget
            </span>
            <span>
              <i className="future-key" />
              Projected
            </span>
          </div>
        </div>
        <p className="calendar-mobile-note">
          Rounded amounts · tap a day for the exact breakdown.
        </p>
        <CalendarGrid
          days={summary.days}
          onSelect={setSelected}
          selected={selected ?? undefined}
        />
      </section>
      <p className="subtle-note">
        Dashed days are future projections. Unspent totals include only days
        through today and are not a bank balance.
      </p>
      <div className="mini-stats calendar-totals">
        <div>
          <span>Available this month</span>
          <strong>{money(summary.spendable)}</strong>
        </div>
        <div>
          <span>Daily expenses this month</span>
          <strong>{money(summary.spent)}</strong>
        </div>
        <div>
          <span>
            Unspent through{" "}
            {summary.elapsed.length ? `day ${summary.elapsed.length}` : "today"}
          </span>
          <strong
            className={summary.cumulative < 0 ? "negative" : "positive-text"}
          >
            {money(summary.cumulative)}
          </strong>
        </div>
      </div>
      <DayDrawer
        date={selected}
        onClose={() => setSelected(null)}
        onDateChange={setSelected}
      />
    </>
  );
}
export function PageLoading() {
  return (
    <div
      className="page-skeleton"
      aria-label="Loading your financial plan"
      role="status"
    >
      <div />
      <div className="skeleton-grid">
        <div />
        <div />
        <div />
      </div>
      <div />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
