"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  ArrowDownToLine,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { useApp } from "./provider";
import { summarize, money } from "@/lib/finance";
import { ExpenseRows, PageLoading } from "./calendar";
import { EmptyState } from "./forms";
import { Button } from "./ui/button";
import { downloadFile } from "@/lib/download";
export function ExpensesPage() {
  const { data, month } = useApp();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [search, setSearch] = useState<{ query: string; value: string } | null>(
    null,
  );
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  if (!data) return <PageLoading />;
  const s = summarize(data);
  const term = search?.query === q ? search.value : q;
  const rows = data.expenses
    .filter(
      (e) =>
        `${e.description} ${e.category} ${e.notes}`
          .toLowerCase()
          .includes(term.toLowerCase()) &&
        (category === "all" || e.category === category) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to),
    )
    .sort((a, b) =>
      sort === "amount-desc"
        ? b.amountMinor - a.amountMinor
        : sort === "amount-asc"
          ? a.amountMinor - b.amountMinor
          : sort === "oldest"
            ? a.date.localeCompare(b.date) ||
              a.createdAt.localeCompare(b.createdAt)
            : b.date.localeCompare(a.date) ||
              b.createdAt.localeCompare(a.createdAt),
    );
  function csv() {
    const safe = (v: string) =>
      `"${(/^[=+\-@\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
    const text = [
      "Date,Description,Category,Amount INR,Notes",
      ...rows.map((e) =>
        [
          e.date,
          e.description,
          e.category,
          (e.amountMinor / 100).toFixed(2),
          e.notes,
        ]
          .map(safe)
          .join(","),
      ),
    ].join("\r\n");
    downloadFile(
      text,
      `Spendense-expenses-${month}.csv`,
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Expenses</h1>
          <p>Search, review, and manage recorded transactions.</p>
        </div>
        <Button variant="secondary" onClick={csv}>
          <ArrowDownToLine size={16} />
          Export CSV
        </Button>
      </div>
      <div className="mini-stats">
        <div>
          <span>Recorded monthly spending</span>
          <strong>{money(s.spent)}</strong>
        </div>
        <div>
          <span>Everyday transactions</span>
          <strong>
            {data.expenses.length}
            <small> this month</small>
          </strong>
        </div>
        <div>
          <span>Daily average through today</span>
          <strong>{money(s.dailyAverage)}</strong>
        </div>
      </div>
      <section className="panel expenses-panel">
        <div className="expense-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search expenses"
              placeholder="Find an expense…"
              value={term}
              onChange={(e) => setSearch({ query: q, value: e.target.value })}
            />
          </label>
          <select
            aria-label="Filter expense category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {[...new Set(data.expenses.map((e) => e.category))]
              .sort()
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </select>
          <select
            aria-label="Sort expenses"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-desc">Amount: high to low</option>
            <option value="amount-asc">Amount: low to high</option>
          </select>
        </div>
        <div className="date-filters">
          <span>
            <SlidersHorizontal size={14} />
            Date range
          </span>
          <label>
            From
            <input
              aria-label="Expenses from date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              aria-label="Expenses to date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {(term || category !== "all" || from || to) && (
            <button
              className="text-button"
              onClick={() => {
                setSearch({ query: q, value: "" });
                setCategory("all");
                setFrom("");
                setTo("");
              }}
            >
              <X size={13} />
              Clear filters
            </button>
          )}
        </div>
        <div className="table-heading">
          <span>
            {rows.length} {rows.length === 1 ? "expense" : "expenses"}
          </span>
          <strong>
            {money(rows.reduce((a, e) => a + e.amountMinor, 0))} in this view
          </strong>
        </div>
        {rows.length ? (
          <ExpenseRows expenses={rows} showDate />
        ) : (
          <EmptyState
            icon={<ArrowLeftRight size={25} />}
            title={
              data.expenses.length
                ? "Nothing matches just yet"
                : "No expenses recorded"
            }
            description={
              data.expenses.length
                ? "Try another search, category, or date range."
                : "Add your first expense using the button at the top. We’ll connect the dots."
            }
          />
        )}
      </section>
    </>
  );
}
