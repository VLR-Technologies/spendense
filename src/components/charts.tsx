"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";
import { useReducedMotion } from "motion/react";
import { chartColors } from "@/lib/categories";
import { money } from "@/lib/finance";
import type { DaySummary } from "@/types";
export function DailyChart({
  days,
  spending = false,
}: {
  days: DaySummary[];
  spending?: boolean;
}) {
  const reduced = useReducedMotion();
  if (!days.length)
    return (
      <div className="chart-empty">
        Your chart will begin with your first completed day.
      </div>
    );
  return (
    <div
      className="chart-box"
      role="img"
      aria-label={
        spending
          ? "Daily discretionary spending bar chart"
          : "Daily unspent allocation bar chart, excluding future days"
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={days}
          margin={{ top: 12, right: 5, left: -18, bottom: 0 }}
          barSize={days.length > 20 ? 12 : 20}
        >
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            interval={days.length > 16 ? 3 : 1}
            dy={7}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickFormatter={(v) =>
              Math.abs(v) >= 100000
                ? `${Math.round(v / 100000)}k`
                : `${Math.round(v / 100)}`
            }
          />
          <Tooltip
            cursor={{ fill: "var(--hover)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(v) => money(Number(v), true)}
            labelFormatter={(v) => `Day ${v}`}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar
            animationDuration={350}
            isAnimationActive={!reduced}
            dataKey={spending ? "spent" : "remaining"}
            name={spending ? "Spent" : "Unspent"}
            radius={[4, 4, 0, 0]}
          >
            {days.map((d, i) => (
              <Cell
                key={d.date}
                fill={
                  spending
                    ? "#9a83ef"
                    : d.remaining < 0
                      ? "#ef918a"
                      : i === days.length - 1
                        ? "#8660eb"
                        : "#b8a4f1"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart({
  categories,
}: {
  categories: { name: string; value: number }[];
}) {
  const reduced = useReducedMotion();
  if (!categories.length)
    return (
      <div className="chart-empty">
        Add an expense to see where your money goes.
      </div>
    );
  return (
    <div className="category-chart">
      <div
        className="donut-wrap"
        role="img"
        aria-label="Discretionary spending by category"
      >
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              animationDuration={350}
              isAnimationActive={!reduced}
              data={categories}
              dataKey="value"
              innerRadius={59}
              outerRadius={81}
              paddingAngle={4}
              stroke="none"
              cornerRadius={5}
            >
              {categories.map((c, i) => (
                <Cell key={c.name} fill={chartColors[i % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => money(Number(v))}
              contentStyle={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span>Categories</span>
          <strong>{categories.length}</strong>
        </div>
      </div>
      <div className="category-legend">
        {categories.slice(0, 5).map((c, i) => (
          <div key={c.name}>
            <span>
              <i style={{ background: chartColors[i % chartColors.length] }} />
              {c.name}
            </span>
            <strong>{money(c.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ComparisonChart({
  months,
}: {
  months: { name: string; income: number; spent: number; fixed: number }[];
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="chart-box"
      role="img"
      aria-label="Income, commitments, and recorded spending by month"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months} margin={{ left: -20, right: 10, top: 15 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => `${v / 100000}k`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(v) => money(Number(v))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          />
          <Bar
            animationDuration={350}
            isAnimationActive={!reduced}
            dataKey="income"
            name="Income"
            fill="#c8bbf2"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            animationDuration={350}
            isAnimationActive={!reduced}
            dataKey="fixed"
            name="Commitments"
            fill="#f2b76c"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            animationDuration={350}
            isAnimationActive={!reduced}
            dataKey="spent"
            name="Spending"
            fill="#57baa5"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CumulativeChart({ days }: { days: DaySummary[] }) {
  const reduced = useReducedMotion();
  const elapsed = days.filter((d) => !d.future);
  const rows = elapsed.map((d, index) => ({
    day: d.day,
    spent: elapsed
      .slice(0, index + 1)
      .reduce((total, item) => total + item.spent, 0),
  }));
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ left: -20, top: 10, right: 10 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b6cf0" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8b6cf0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 4"
            stroke="var(--border)"
          />
          <XAxis dataKey="day" axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${v / 100000}k`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(v) => money(Number(v))} />
          <Area
            animationDuration={350}
            isAnimationActive={!reduced}
            type="monotone"
            dataKey="spent"
            name="Cumulative spending"
            stroke="#8b6cf0"
            fill="url(#areaFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
