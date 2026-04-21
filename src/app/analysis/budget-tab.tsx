"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

type BudgetData = {
  budgetHealth: Array<{
    month: string;
    totalSpent: number;
    totalBudgeted: number;
    utilisation: number;
    overBudgetCount: number;
  }>;
};

function formatShortMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return format(new Date(year, m - 1, 1), "MMM yy");
}

export function BudgetTab({ data }: { data: BudgetData }) {
  const utilisationData = useMemo(
    () =>
      data.budgetHealth.map((entry) => ({
        month: formatShortMonth(entry.month),
        utilisation: Math.round(entry.utilisation * 10) / 10,
      })),
    [data.budgetHealth],
  );

  const overBudgetData = useMemo(
    () =>
      data.budgetHealth.map((entry) => ({
        month: formatShortMonth(entry.month),
        count: entry.overBudgetCount,
      })),
    [data.budgetHealth],
  );

  if (data.budgetHealth.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
        No budget data found for this period.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Budget Utilisation */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Budget Utilisation
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Percentage of total budget spent each month
          </p>
        </div>
        <div className="px-6 py-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={utilisationData}
              margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
            >
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis-muted)", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Utilisation"]}
                contentStyle={{
                  borderRadius: "16px",
                  borderColor: "var(--tooltip-border)",
                  boxShadow: "var(--tooltip-shadow)",
                }}
              />
              <ReferenceLine
                y={100}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{
                  value: "100%",
                  position: "right",
                  fill: "#ef4444",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="utilisation"
                stroke="#57534e"
                strokeWidth={2}
                dot={{ r: 4, fill: "#57534e" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Categories Over Budget */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Categories Over Budget
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Number of categories exceeding their budget each month
          </p>
        </div>
        <div className="px-6 py-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={overBudgetData}
              margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
            >
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis-muted)", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [value, "Categories"]}
                contentStyle={{
                  borderRadius: "16px",
                  borderColor: "var(--tooltip-border)",
                  boxShadow: "var(--tooltip-shadow)",
                }}
              />
              <Bar
                dataKey="count"
                fill="#ef4444"
                radius={[8, 8, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
