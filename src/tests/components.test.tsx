import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarGrid } from "@/components/calendar";
import { Dialog } from "@/components/ui/dialog";
import {
  MonthlyBudgetBreakdown,
  DailyBudgetBreakdown,
} from "@/components/budget-breakdown";
import { allocate, preciseMoney } from "@/lib/finance";
import type { DaySummary } from "@/types";
const days: DaySummary[] = allocate(300000, 30).map((allowance, i) => ({
  day: i + 1,
  date: `2026-09-${String(i + 1).padStart(2, "0")}`,
  allowance,
  gross: allowance,
  fixed: 0,
  spent: 0,
  remaining: allowance,
  future: false,
  expenses: [],
}));
describe("accessible calendar and dialog", () => {
  it("calendar dates have descriptive labels and select the exact date", () => {
    const select = vi.fn();
    render(<CalendarGrid days={days} onSelect={select} />);
    const day = screen.getByRole("button", { name: /^Tuesday, 1 September\./ });
    fireEvent.click(day);
    expect(select).toHaveBeenCalledWith("2026-09-01");
    expect(day).toHaveAccessibleName(/Allowance ₹100/);
  });
  it("arrow keys move focus by day and week", () => {
    render(<CalendarGrid days={days} onSelect={() => {}} />);
    const first = screen.getByRole("button", {
      name: /^Tuesday, 1 September\./,
    });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(
      screen.getByRole("button", { name: /^Wednesday, 2 September\./ }),
    ).toHaveFocus();
    const next = screen.getByRole("button", {
      name: /^Wednesday, 2 September\./,
    });
    fireEvent.keyDown(next, { key: "ArrowDown" });
    expect(
      screen.getByRole("button", { name: /^Wednesday, 9 September\./ }),
    ).toHaveFocus();
  });
  it("overspending has a text label as well as a color", () => {
    const altered = days.map((d, i) =>
      i === 0 ? { ...d, remaining: -5000, spent: 15000 } : d,
    );
    render(<CalendarGrid days={altered} onSelect={() => {}} />);
    expect(
      screen.getByRole("button", { name: /^Tuesday, 1 September\./ }),
    ).toHaveAccessibleName(/Over budget/);
    expect(screen.getByText("Over budget")).toBeVisible();
  });
  it("dialog exposes a title and closes with Escape", () => {
    const close = vi.fn();
    render(
      <Dialog
        open
        onClose={close}
        title="Add an expense"
        description="Daily spending"
      >
        <label>
          Amount
          <input />
        </label>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Add an expense");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).toHaveBeenCalled();
  });
  it("uses one tab stop and Home/End navigation without leaving the month", () => {
    render(
      <CalendarGrid days={days} onSelect={() => {}} selected="2026-09-02" />,
    );
    const second = screen.getByRole("button", {
      name: /^Wednesday, 2 September\./,
    });
    expect(
      screen.getAllByRole("button").filter((button) => button.tabIndex === 0),
    ).toEqual([second]);
    second.focus();
    fireEvent.keyDown(second, { key: "Home" });
    const first = screen.getByRole("button", {
      name: /^Tuesday, 1 September\./,
    });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "End" });
    expect(
      screen.getByRole("button", { name: /^Sunday, 6 September\./ }),
    ).toHaveFocus();
  });
  it("announces exact future negative amounts and selected state", () => {
    const future = [
      {
        ...days[0],
        future: true,
        allowance: -1001,
        remaining: -2002,
        spent: 1001,
      },
    ];
    render(
      <CalendarGrid
        days={future}
        selected={future[0].date}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      /Allowance -₹10.01, spent ₹10.01, projected remaining -₹20.02. Over budget/,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
  it("handles a month change without retaining an invalid tab stop", () => {
    const { rerender } = render(
      <CalendarGrid days={days} onSelect={() => {}} />,
    );
    const last = screen.getAllByRole("button").at(-1)!;
    last.focus();
    fireEvent.focus(last);
    const next = days.slice(0, 28).map((day) => ({
      ...day,
      date: `2027-02-${String(day.day).padStart(2, "0")}`,
    }));
    rerender(<CalendarGrid days={next} onSelect={() => {}} />);
    expect(
      screen.getAllByRole("button").filter((button) => button.tabIndex === 0),
    ).toHaveLength(1);
    expect(screen.getAllByRole("button")[0]).toHaveAttribute("tabindex", "0");
  });
});

describe("financial explanations", () => {
  it("labels the average separately from exact daily values and keeps income editing available", () => {
    const edit = vi.fn();
    render(
      <MonthlyBudgetBreakdown
        income={10000003}
        fixed={1900007}
        spendable={8099996}
        averageAllowance={261290}
        dayCount={31}
        onEditIncome={edit}
      />,
    );
    expect(
      screen.getByRole("region", { name: "Monthly budget calculation" }),
    ).toBeVisible();
    expect(screen.getByText("₹1,00,000.03")).toBeVisible();
    expect(screen.getByText("₹19,000.07")).toBeVisible();
    expect(screen.getByText("₹80,999.96")).toBeVisible();
    expect(screen.getByText("Daily allowance · average")).toBeVisible();
    expect(screen.getByRole("link", { name: "Manage plan" })).toHaveAttribute(
      "href",
      "/monthly-plan",
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit income" }));
    expect(edit).toHaveBeenCalledOnce();
  });
  it.each([
    [100000, 19000, 81000, 50000, 31000, false],
    [0, 1000, -1000, 5000, -6000, false],
    [0, 0, 0, 0, 0, false],
    [10003, 1902, 8101, 5001, 3100, true],
  ])(
    "shows the full daily equation with signed exact values (%i)",
    (gross, fixed, allowance, spent, remaining, future) => {
      render(
        <DailyBudgetBreakdown
          day={{
            ...days[0],
            gross,
            fixed,
            allowance,
            spent,
            remaining,
            future,
          }}
        />,
      );
      expect(
        screen.getAllByRole("term").map((term) => term.textContent),
      ).toEqual([
        "Income allocation",
        "− Fixed deductions",
        "= Daily allowance",
        "− Daily expenses",
        future ? "= Projected remaining" : "= Remaining amount",
      ]);
      expect(
        screen.getAllByRole("definition").map((value) => value.textContent),
      ).toEqual([gross, fixed, allowance, spent, remaining].map(preciseMoney));
    },
  );
});
