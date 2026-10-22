import { describe, it, expect } from "vitest";
import { allocate, summarize, sum, toMinor, money } from "@/lib/finance";
import { dateAt, daysInMonth } from "@/lib/dates";
import type { MonthData, DailyExpense } from "@/types";
const makeExpense = (date: string, amountMinor: number): DailyExpense => ({
  id: date,
  profileId: "p",
  date,
  amountMinor,
  category: "Food",
  description: "Lunch",
  notes: "",
  createdAt: "",
  updatedAt: "",
});
function data(
  month = "2026-09",
  income = 10_000_000,
  fixed = 1_900_000,
  expenses: DailyExpense[] = [],
): MonthData {
  return {
    plan: {
      id: "m",
      profileId: "p",
      yearMonth: month,
      monthlyIncomeMinor: income,
      incomeOverride: false,
      createdAt: "",
    },
    commitments: [
      {
        id: "c",
        profileId: "p",
        yearMonth: month,
        name: "Bills",
        category: "Other",
        amountMinor: fixed,
        origin: "recurring",
        paid: false,
        notes: "",
      },
    ],
    expenses,
    recurring: [],
    defaultIncomeMinor: income,
  };
}
describe("exact minor-unit financial calculations", () => {
  it("A: ₹100,000 - ₹19,000 over 30 days gives ₹2,700 and ₹2,200 after ₹500", () => {
    const s = summarize(
      data("2026-09", 10_000_000, 1_900_000, [
        makeExpense("2026-09-15", 50_000),
      ]),
      "2026-09-15",
    );
    expect(s.days[14]).toMatchObject({
      allowance: 270000,
      spent: 50000,
      remaining: 220000,
    });
    expect(s.days[14].gross - s.days[14].fixed).toBe(270000);
    expect(s.cumulative).toBe(15 * 270000 - 50000);
  });
  it("B: distributes 31 days exactly, with one-paise maximum difference", () => {
    const s = summarize(data("2026-10"));
    expect(s.days).toHaveLength(31);
    expect(sum(s.days.map((d) => d.allowance))).toBe(8100000);
    expect(
      Math.max(...s.days.map((d) => d.allowance)) -
        Math.min(...s.days.map((d) => d.allowance)),
    ).toBe(1);
  });
  it.each([
    ["2026-02", 28],
    ["2028-02", 29],
    ["2000-02", 29],
    ["2100-02", 28],
  ])("C: February %s has %i days and loses no money", (month, count) => {
    const s = summarize(data(month));
    expect(s.days).toHaveLength(count);
    expect(sum(s.days.map((d) => d.gross))).toBe(10000000);
    expect(sum(s.days.map((d) => d.fixed))).toBe(1900000);
  });
  it("D: no income and mandatory costs produce negative budgets", () => {
    const s = summarize(
      data("2026-09", 0, 30000, [makeExpense("2026-09-01", 5000)]),
      "2026-09-01",
    );
    expect(s.days[0].allowance).toBe(-1000);
    expect(s.days[0].remaining).toBe(-6000);
    expect(s.cumulative).toBe(-6000);
    expect(s.remaining).toBe(-35000);
  });
  it("E: overspending is shown as a signed negative amount", () => {
    const s = summarize(
      data("2026-09", 30000, 0, [makeExpense("2026-09-01", 1500)]),
      "2026-09-01",
    );
    expect(s.days[0].remaining).toBe(-500);
    expect(s.overBudget).toBe(1);
  });
  it("G: edited and deleted expenses recalculate the entire month", () => {
    const d = data("2026-09", 300000, 0, [makeExpense("2026-09-01", 7000)]);
    expect(summarize(d).spent).toBe(7000);
    d.expenses[0].amountMinor = 15000;
    expect(summarize(d).days[0].remaining).toBe(-5000);
    d.expenses = [];
    expect(summarize(d).days[0].remaining).toBe(10000);
  });
  it("J: exact signed remainder allocation across thousands of totals", () => {
    for (const count of [28, 29, 30, 31])
      for (let total = -100000; total <= 100000; total += 137) {
        const values = allocate(total, count);
        expect(sum(values)).toBe(total);
        expect(values.every(Number.isInteger)).toBe(true);
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(
          1,
        );
        expect(allocate(total, count)).toEqual(values);
      }
  });
  it("gross minus fixed matches net on every day, even across separate remainders", () => {
    const s = summarize(data("2026-10", 10000003, 1900007));
    for (const d of s.days) expect(d.gross - d.fixed).toBe(d.allowance);
    expect(sum(s.days.map((d) => d.fixed))).toBe(1900007);
  });
  it("K: paid metadata never changes the budget", () => {
    const d = data();
    const before = summarize(d);
    d.commitments[0].paid = true;
    const after = summarize(d);
    expect(after.fixed).toBe(before.fixed);
    expect(after.days).toEqual(before.days);
  });
  it("future projections never become cumulative savings", () => {
    const s = summarize(
      data("2026-09", 300000, 0, [makeExpense("2026-09-28", 20000)]),
      "2026-09-05",
    );
    expect(s.cumulative).toBe(50000);
    expect(s.spent).toBe(20000);
    expect(s.elapsedSpent).toBe(0);
    expect(s.elapsed).toHaveLength(5);
  });
  it("a future month has zero elapsed unspent allocation", () => {
    const s = summarize(data("2026-11"), "2026-10-21");
    expect(s.cumulative).toBe(0);
    expect(s.elapsed).toHaveLength(0);
    expect(s.current).toBeUndefined();
  });
  it("parses monetary decimals without binary float accumulation", () => {
    expect(toMinor("0.29")).toBe(29);
    expect(toMinor("100000.01")).toBe(10000001);
    expect(toMinor("1.1")).toBe(110);
    for (const invalid of [
      "-1",
      "1.001",
      "Infinity",
      "",
      "1e8",
      "9007199254740991",
    ])
      expect(() => toMinor(invalid)).toThrow();
  });
  it("formats Indian numbering and safe date-only values", () => {
    expect(money(29)).toBe("₹0.29");
    expect(money(1000050)).toBe("₹10,000.50");
    expect(money(10000000)).toContain("1,00,000");
    expect(dateAt("2028-02", 9)).toBe("2028-02-09");
    expect(daysInMonth("2028-02")).toBe(29);
  });
  it("rejects unsafe integer allocations", () => {
    expect(() => allocate(0.1, 30)).toThrow();
    expect(() => allocate(1, 0)).toThrow();
  });
});
