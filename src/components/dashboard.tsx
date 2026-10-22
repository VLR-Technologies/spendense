"use client";
import Link from "next/link";
import { customerName } from "@/lib/identity";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Wallet,
  TrendingUp,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "./provider";
import { AnimatedMoney, IncomeForm, EmptyState } from "./forms";
import { CalendarGrid, DayDrawer, ExpenseRows, PageLoading } from "./calendar";
import { CategoryChart, DailyChart } from "./charts";
import { summarize, money, preciseMoney } from "@/lib/finance";
import { monthLabel } from "@/lib/dates";
import { Dialog } from "./ui/dialog";
import { MonthlyBudgetBreakdown } from "./budget-breakdown";
export function Dashboard() {
  const { data, month, account, mode, profile, guestName } = useApp();
  const identity = customerName(
    mode === "cloud" ? account : null,
    guestName,
    profile?.demo,
  );
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  if (!data) return <PageLoading />;
  const s = summarize(data);
  const active = s.current;
  const daily = active?.allowance ?? s.averageAllowance;
  const recent = [...data.expenses]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 4);
  const base = Math.max(s.income, s.fixed + s.spent, 1);
  const spentPercent =
    s.elapsedAllowance > 0
      ? Math.round((s.elapsedSpent / s.elapsedAllowance) * 100)
      : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="customer-greeting" title={`${greeting}, ${identity}`}>
            {greeting}, {identity}
          </h1>
          <p>
            Your Financial Overview <span aria-hidden="true">·</span>{" "}
            {monthLabel(month)}
            {profile?.demo
              ? " · Demo data"
              : mode === "local"
                ? " · Guest Mode"
                : ""}
          </p>
        </div>
      </div>
      <div className="overview-grid">
        <section className={`daily-hero ${daily < 0 ? "negative-hero" : ""}`}>
          <div className="hero-topline">
            <span className="hero-icon">
              <Wallet size={21} />
            </span>
            <span>
              <span className="hero-customer" title={identity}>
                {identity}
              </span>
            </span>
            <span className="hero-sparkle">
              <Sparkles size={19} />
            </span>
          </div>
          <div className="hero-context">
            {active
              ? new Date(`${active.date}T12:00:00`).toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "long", weekday: "long" },
                )
              : `${monthLabel(month)} · Daily average`}
          </div>
          <div className="hero-budget-label">
            {active ? "Available today" : "Average daily allowance"}
          </div>
          <div className="hero-amount">
            <AnimatedMoney value={daily} exact />
            <span>/ day</span>
          </div>
          {!active && (
            <p>
              Average across {s.days.length} days. Select a day for its exact
              allowance.
            </p>
          )}
          {!active && <span className="hero-period-note">Monthly totals</span>}
          <div className="hero-bottom">
            <div>
              <span>
                {active ? "Daily Spending" : "Daily expenses this month"}
              </span>
              <strong>{money(active?.spent ?? s.spent)}</strong>
            </div>
            <div>
              <span>{active ? "Remaining Today" : "Remaining this month"}</span>
              <strong>{preciseMoney(active?.remaining ?? s.remaining)}</strong>
            </div>
            <button
              className="hero-arrow"
              aria-label="Review daily budget"
              onClick={() => setSelected(active?.date ?? s.days[0].date)}
            >
              <ArrowUpRight size={21} />
            </button>
          </div>
          <div className="hero-orbit orbit-a" />
          <div className="hero-orbit orbit-b" />
        </section>
        <MonthlyBudgetBreakdown
          income={s.income}
          fixed={s.fixed}
          spendable={s.spendable}
          averageAllowance={s.averageAllowance}
          dayCount={s.days.length}
          onEditIncome={() => setIncomeOpen(true)}
        />
      </div>
      <div className="allocation-strip">
        <div className="allocation-main">
          <span className="allocation-icon">
            <TrendingUp size={19} />
          </span>
          <div>
            <span>
              Unspent through{" "}
              {s.elapsed.length ? `day ${s.elapsed.length}` : "today"}
            </span>
            <strong className={s.cumulative < 0 ? "negative" : "positive-text"}>
              <AnimatedMoney value={s.cumulative} />
            </strong>
          </div>
          <details className="allocation-help">
            <summary>About this amount</summary>
            <p>
              Allowances minus recorded expenses through{" "}
              {s.elapsed.length ? `day ${s.elapsed.length}` : "today"}. Future
              days are excluded. This is a budget allocation, not a bank balance
              or verified savings.
            </p>
          </details>
        </div>
        <div className="allocation-detail">
          <div className="allocation-labels">
            <span>Monthly allocation distribution</span>
          </div>
          <div className="allocation-track">
            <span style={{ width: `${(s.fixed / base) * 100}%` }} />
            <span style={{ width: `${(s.spent / base) * 100}%` }} />
            <span
              style={{ width: `${(Math.max(0, s.remaining) / base) * 100}%` }}
            />
          </div>
          <div className="allocation-legend">
            <span>
              <i className="amber-dot" />
              Commitments
            </span>
            <span>
              <i className="purple-dot" />
              Spent {money(s.spent)}
            </span>
            <span>
              <i className="teal-dot" />
              Remaining {money(s.remaining)}
            </span>
          </div>
        </div>
      </div>
      <div className="dashboard-bottom">
        <section className="panel calendar-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Remaining by day{" "}
                <span className="soft-tag">
                  {monthLabel(month, true).toUpperCase()}
                </span>
              </h2>
              <p>
                Allowance − daily expenses. Rounded; select for exact amounts.
              </p>
            </div>
            <Link href="/calendar" className="text-link">
              Open calendar
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <CalendarGrid
            compact
            days={s.days}
            onSelect={setSelected}
            selected={selected ?? undefined}
          />
          <div className="chart-footer">
            <span>
              <i className="teal-dot" />
              Unspent
            </span>
            <span>
              <i className="negative-key" />
              Over budget
            </span>
            <span>
              <i className="future-key" />
              Future projection
            </span>
          </div>
        </section>
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Transactions</h2>
            </div>
            <Link
              href="/expenses"
              className="icon-button"
              aria-label="All expenses"
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
          {recent.length ? (
            <ExpenseRows compact expenses={recent} showDate />
          ) : (
            <EmptyState
              title="No expenses yet"
              description="Add your first expense using the button above."
            />
          )}
          <Link className="recent-all" href="/expenses">
            View all expenses
            <ArrowRight size={15} />
          </Link>
          <div className="pace-note">
            <span>
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>
                {spentPercent === null
                  ? "Spending pace"
                  : spentPercent <= 100
                    ? "Within allocated budget"
                    : "Above allocated budget"}
              </strong>
              <p>
                {spentPercent === null
                  ? "Set an income to see how your spending compares."
                  : `${spentPercent}% of your elapsed allowance spent. Based on the expenses you’ve recorded.`}
              </p>
            </div>
          </div>
        </section>
      </div>
      <div className="dashboard-charts">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Daily remaining allocation</h2>
              <p>Your daily allowance, minus your daily spending.</p>
            </div>
            <Link href="/insights" className="text-link">
              View insights
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <DailyChart days={s.elapsed} />
          <div className="chart-footer">
            <span>
              <i className="purple-dot" />
              Daily unspent amount
            </span>
            <span>
              {s.overBudget
                ? `${s.overBudget} ${s.overBudget === 1 ? "day" : "days"} over budget`
                : "Within elapsed allowance"}
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Spending by category</h2>
              <p>Daily expenses recorded this month.</p>
            </div>
            <span className="panel-mini-icon">
              <ArrowUpRight size={17} />
            </span>
          </div>
          <CategoryChart categories={s.categories} />
          <div className="category-total">
            <span>Total monthly spending</span>
            <strong>{money(s.spent)}</strong>
          </div>
        </section>
      </div>
      <Dialog
        open={incomeOpen}
        onClose={() => setIncomeOpen(false)}
        title="Edit monthly income"
        description={monthLabel(month)}
      >
        <IncomeForm onDone={() => setIncomeOpen(false)} />
      </Dialog>
      <DayDrawer
        date={selected}
        onClose={() => setSelected(null)}
        onDateChange={setSelected}
      />
    </>
  );
}
