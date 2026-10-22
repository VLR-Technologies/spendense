import Link from "next/link";
import { preciseMoney } from "@/lib/finance";
import type { DaySummary } from "@/types";

/** Presentation only: all values come from the existing minor-unit finance engine. */
export function MonthlyBudgetBreakdown({
  income,
  fixed,
  spendable,
  averageAllowance,
  dayCount,
  onEditIncome,
}: {
  income: number;
  fixed: number;
  spendable: number;
  averageAllowance: number;
  dayCount: number;
  onEditIncome: () => void;
}) {
  return (
    <section
      className="panel budget-breakdown"
      aria-label="Monthly budget calculation"
    >
      <div className="panel-heading">
        <h2>Monthly Overview</h2>
        <button className="text-link" onClick={onEditIncome}>
          Edit income
        </button>
      </div>
      <dl className="budget-equation">
        <div>
          <dt>Monthly income</dt>
          <dd className="summary-value">{preciseMoney(income)}</dd>
        </div>
        <div>
          <dt>
            <span aria-hidden="true">−</span> Fixed deductions
          </dt>
          <dd>{preciseMoney(fixed)}</dd>
        </div>
        <div className="equation-subtotal">
          <dt>
            <span aria-hidden="true">=</span> Available for daily spending
          </dt>
          <dd className={spendable < 0 ? "negative" : ""}>
            {preciseMoney(spendable)}
          </dd>
        </div>
        <div className="equation-result">
          <dt>
            <span aria-hidden="true">÷</span> {dayCount} days{" "}
            <span className="equation-average">Daily allowance · average</span>
          </dt>
          <dd className={averageAllowance < 0 ? "negative" : ""}>
            {preciseMoney(averageAllowance)}
          </dd>
        </div>
      </dl>
      <p className="budget-explanation">
        Income is allocated across the month, not received daily. Fixed
        deductions include recurring and one-time commitments.{" "}
        <Link href="/monthly-plan">Manage plan</Link>
      </p>
    </section>
  );
}

export function DailyBudgetBreakdown({ day }: { day: DaySummary }) {
  return (
    <dl className="day-breakdown" aria-label="Daily budget calculation">
      <div>
        <dt>Income allocation</dt>
        <dd>{preciseMoney(day.gross)}</dd>
      </div>
      <div>
        <dt>− Fixed deductions</dt>
        <dd>{preciseMoney(day.fixed)}</dd>
      </div>
      <div className="breakdown-total">
        <dt>= Daily allowance</dt>
        <dd>{preciseMoney(day.allowance)}</dd>
      </div>
      <div>
        <dt>− Daily expenses</dt>
        <dd>{preciseMoney(day.spent)}</dd>
      </div>
      <div
        className={`breakdown-total breakdown-remaining ${day.remaining < 0 ? "negative" : ""}`}
      >
        <dt>= {day.future ? "Projected remaining" : "Remaining amount"}</dt>
        <dd>{preciseMoney(day.remaining)}</dd>
      </div>
    </dl>
  );
}
