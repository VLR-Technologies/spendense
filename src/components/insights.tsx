"use client";
import { Lightbulb, ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import { useApp } from "./provider";
import { summarize, money, sum } from "@/lib/finance";
import { monthLabel, shiftMonth } from "@/lib/dates";
import { PageLoading } from "./calendar";
import {
  DailyChart,
  CategoryChart,
  ComparisonChart,
  CumulativeChart,
} from "./charts";
export function InsightsPage() {
  const { history: backup, data, month } = useApp();
  const plans = backup?.plans ?? [];
  const expenses = backup?.expenses ?? [];
  const commitments = (backup?.commitments ?? []).filter((c) => !c.excluded);
  const history = plans
    .filter((p) => p.yearMonth <= month && p.yearMonth >= shiftMonth(month, -5))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
    .map((p) => ({
      yearMonth: p.yearMonth,
      name: monthLabel(p.yearMonth, true),
      income: p.monthlyIncomeMinor,
      fixed: sum(
        commitments
          .filter((c) => c.yearMonth === p.yearMonth)
          .map((c) => c.amountMinor),
      ),
      spent: sum(
        expenses
          .filter((e) => e.date.startsWith(p.yearMonth))
          .map((e) => e.amountMinor),
      ),
    }));
  if (!data) return <PageLoading />;
  const s = summarize(data);
  const previous = history.find((h) => h.yearMonth === shiftMonth(month, -1));
  const pace =
    s.elapsedAllowance > 0 ? (s.elapsedSpent / s.elapsedAllowance) * 100 : null;
  const weeks = [0, 1, 2, 3, 4]
    .map((i) => ({
      name: `Week ${i + 1}`,
      value: sum(
        s.days
          .filter((d) => Math.floor((d.day - 1) / 7) === i)
          .map((d) => d.spent),
      ),
    }))
    .filter((_, i) => i * 7 < s.days.length);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A STEP BACK. A CLEARER PICTURE.</span>
          <h1>
            Little patterns, useful perspective
            <span className="heading-dot">.</span>
          </h1>
          <p>Get to know your spending. One insight at a time.</p>
        </div>
        <span className="insights-decoration">
          <ChartNoAxesCombined size={32} />
        </span>
      </div>
      <div className="insight-stats">
        {[
          { label: "Monthly income", value: money(s.income) },
          { label: "Fixed commitments", value: money(s.fixed) },
          { label: "Discretionary spending", value: money(s.spent) },
          { label: "Unspent monthly allocation", value: money(s.remaining) },
          { label: "Daily spending average¹", value: money(s.dailyAverage) },
          {
            label: "Highest spending day",
            value: s.highest
              ? `${s.highest.day} ${monthLabel(month, true).split(" ")[0]}`
              : "—",
            sub: s.highest ? money(s.highest.spent) : "No recorded expenses",
          },
          {
            label: "Top spending category",
            value: s.categories[0]?.name ?? "—",
            sub: s.categories[0]
              ? money(s.categories[0].value)
              : "No recorded expenses",
          },
          {
            label: "Days over budget¹",
            value: String(s.overBudget),
            sub: `Of ${s.elapsed.length} elapsed days`,
          },
        ].map((item) => (
          <div className="insight-stat" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.sub && <small>{item.sub}</small>}
          </div>
        ))}
      </div>
      {s.categories.length > 0 ? (
        <div className="insight-callout">
          <span>
            <Lightbulb size={23} />
          </span>
          <div>
            <strong>A little insight for your month.</strong>
            <p>
              {s.categories[0].name} accounts for{" "}
              {Math.round((s.categories[0].value / s.spent) * 100)}% of your
              recorded discretionary spending.
              {previous &&
                previous.spent > 0 &&
                ` Your recorded spending is ${money(Math.abs(s.spent - previous.spent))} ${s.spent > previous.spent ? "higher" : "lower"} than last month’s total so far.`}
            </p>
          </div>
          <ArrowUpRight size={20} />
        </div>
      ) : (
        <div className="insight-callout">
          <Lightbulb size={23} />
          <div>
            <strong>Your patterns start with your first expense.</strong>
            <p>
              Add a few everyday transactions and your insights will take shape.
            </p>
          </div>
        </div>
      )}
      <div className="insights-chart-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Where it’s going</h2>
              <p>Your category mix, for this month.</p>
            </div>
          </div>
          <CategoryChart categories={s.categories} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your daily spending</h2>
              <p>Recorded expenses, including any future-dated entries.</p>
            </div>
          </div>
          <DailyChart days={s.days} spending />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>A little monthly perspective</h2>
              <p>Income, commitments & spending across saved plans.</p>
            </div>
          </div>
          <ComparisonChart months={history} />
          <div className="chart-footer">
            <span>
              <i style={{ background: "#c8bbf2" }} />
              Income
            </span>
            <span>
              <i className="amber-dot" />
              Commitments
            </span>
            <span>
              <i className="teal-dot" />
              Spending
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your spending pace</h2>
              <p>Recorded spending against the allowance through today.</p>
            </div>
          </div>
          <div className="pace-visual">
            <strong>{pace === null ? "—" : `${Math.round(pace)}%`}</strong>
            <span>of elapsed allowance used</span>
            <div className="pace-track">
              <span
                style={{
                  width: `${Math.min(Math.max(pace ?? 0, 0), 100)}%`,
                  background: (pace ?? 0) > 100 ? "var(--negative)" : undefined,
                }}
              />
            </div>
            <div className="pace-totals">
              <span>{money(s.elapsedSpent)} spent</span>
              <span>{money(s.elapsedAllowance)} planned</span>
            </div>
            <p>
              {pace === null
                ? "Set a positive income after commitments to compare your pace."
                : pace > 100
                  ? "Recorded spending is above your allowance through today."
                  : "Recorded spending is within your allowance through today."}
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Week by little week</h2>
              <p>Recorded spending in seven-day groups.</p>
            </div>
          </div>
          <div className="weekly-chart">
            {weeks.map((w) => (
              <div key={w.name}>
                <span>{w.name}</span>
                <div>
                  <span
                    style={{
                      width: `${(w.value / Math.max(...weeks.map((w) => w.value), 1)) * 100}%`,
                    }}
                  />
                </div>
                <strong>{money(w.value)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>The spending story, so far</h2>
              <p>Cumulative discretionary spending through today.</p>
            </div>
          </div>
          <CumulativeChart days={s.days} />
        </section>
      </div>
      <p className="subtle-note">
        ¹ Daily average and days over budget use elapsed calendar days only.
        Future allowances are projections. Monthly comparisons use recorded
        totals, which may represent different numbers of days. Unspent
        allocation is a budget measure, not a verified cash balance.
      </p>
    </>
  );
}
