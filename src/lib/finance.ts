import type { DaySummary, MonthData } from "@/types";
import { dateAt, daysInMonth, today } from "./dates";

/** Allocate signed integer minor units exactly, with remainder assigned to earliest days. */
export function allocate(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total) || !Number.isInteger(count) || count < 1)
    throw new Error("Invalid allocation");
  const sign = total < 0 ? -1 : 1;
  const base = Math.floor(Math.abs(total) / count);
  const remainder = Math.abs(total) % count;
  return Array.from(
    { length: count },
    (_, index) => sign * (base + (index < remainder ? 1 : 0)),
  );
}
export const sum = (values: number[]) =>
  values.reduce((a, b) => {
    const total = a + b;
    if (!Number.isSafeInteger(total))
      throw new Error("Total exceeds the supported financial range");
    return total;
  }, 0);
export function summarize(data: MonthData, asOf = today()) {
  const month = data.plan.yearMonth;
  const count = daysInMonth(month);
  const income = data.plan.monthlyIncomeMinor;
  const fixed = sum(data.commitments.map((c) => c.amountMinor));
  const spendable = income - fixed;
  const gross = allocate(income, count);
  const net = allocate(spendable, count);
  // Fixed allocations are the difference so gross - fixed = net on every date.
  const days: DaySummary[] = net.map((allowance, i) => {
    const date = dateAt(month, i + 1);
    const expenses = data.expenses.filter((e) => e.date === date);
    const spent = sum(expenses.map((e) => e.amountMinor));
    return {
      date,
      day: i + 1,
      gross: gross[i],
      fixed: gross[i] - allowance,
      allowance,
      spent,
      remaining: allowance - spent,
      future: date > asOf,
      expenses,
    };
  });
  const elapsed = days.filter((d) => !d.future);
  const spent = sum(days.map((d) => d.spent));
  const elapsedSpent = sum(elapsed.map((d) => d.spent));
  const elapsedAllowance = sum(elapsed.map((d) => d.allowance));
  const categories = [...new Set(data.expenses.map((e) => e.category))]
    .map((name) => ({
      name,
      value: sum(
        data.expenses
          .filter((e) => e.category === name)
          .map((e) => e.amountMinor),
      ),
    }))
    .sort((a, b) => b.value - a.value);
  return {
    income,
    fixed,
    spendable,
    spent,
    remaining: spendable - spent,
    days,
    elapsed,
    elapsedSpent,
    elapsedAllowance,
    cumulative: elapsedAllowance - elapsedSpent,
    dailyAverage: elapsed.length
      ? Math.round(elapsedSpent / elapsed.length)
      : 0,
    overBudget: elapsed.filter((d) => d.remaining < 0).length,
    highest: [...days]
      .filter((d) => d.spent > 0)
      .sort((a, b) => b.spent - a.spent)[0],
    categories,
    current: days.find((d) => d.date === asOf),
    averageAllowance: Math.round(spendable / count),
  };
}
export const money = (minor: number, decimals = minor % 100 !== 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals ? 2 : 0,
    minimumFractionDigits: decimals ? 2 : 0,
  }).format(minor / 100);
export const preciseMoney = (minor: number) => money(minor, minor % 100 !== 0);
export const compactMoney = (minor: number) => {
  const amount = Math.abs(minor) / 100;
  const sign = minor < 0 ? "−" : "";
  if (amount >= 10000000)
    return `${sign}₹${Number((amount / 10000000).toFixed(1))}Cr`;
  if (amount >= 100000)
    return `${sign}₹${Number((amount / 100000).toFixed(1))}L`;
  if (amount >= 1000) return `${sign}₹${Number((amount / 1000).toFixed(1))}k`;
  return money(minor, false);
};
export function toMinor(value: string | number): number {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new Error("Enter a valid amount with up to two decimal places.");
  const [rupees, paise = ""] = raw.split(".");
  const result = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000_000)
    throw new Error("Amount is too large.");
  return result;
}
