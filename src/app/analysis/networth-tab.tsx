"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

type NetWorthData = {
  netWorthByMonth: Array<{
    month: string;
    remainingDebt: number;
    totalSavings: number;
    netWorth: number;
  }>;
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatChartCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatShortMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return format(new Date(year, m - 1, 1), "MMM yy");
}

export function NetWorthTab({ data }: { data: NetWorthData }) {
  const debtData = useMemo(
    () =>
      data.netWorthByMonth.map((entry) => ({
        month: formatShortMonth(entry.month),
        remainingDebt: entry.remainingDebt,
      })),
    [data.netWorthByMonth],
  );

  const savingsData = useMemo(
    () =>
      data.netWorthByMonth.map((entry) => ({
        month: formatShortMonth(entry.month),
        totalSavings: entry.totalSavings,
      })),
    [data.netWorthByMonth],
  );

  const netWorthData = useMemo(
    () =>
      data.netWorthByMonth.map((entry) => ({
        month: formatShortMonth(entry.month),
        netWorth: entry.netWorth,
      })),
    [data.netWorthByMonth],
  );

  if (data.netWorthByMonth.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
        No net worth data found for this period.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Debt Paydown */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Debt Paydown
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Remaining debt balance over time
          </p>
        </div>
        <div className="px-6 py-6">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={debtData}
              margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
            >
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => formatChartCurrency(Number(v))}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis-muted)", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [
                  formatChartCurrency(Number(value)),
                  "Remaining Debt",
                ]}
                contentStyle={{
                  borderRadius: "16px",
                  borderColor: "var(--tooltip-border)",
                  boxShadow: "var(--tooltip-shadow)",
                }}
              />
              <Area
                type="monotone"
                dataKey="remainingDebt"
                stroke="#ef4444"
                fill="#fecaca"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Savings Growth */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Savings Growth
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Cumulative savings contributions over time
          </p>
        </div>
        <div className="px-6 py-6">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={savingsData}
              margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
            >
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => formatChartCurrency(Number(v))}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis-muted)", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [
                  formatChartCurrency(Number(value)),
                  "Total Savings",
                ]}
                contentStyle={{
                  borderRadius: "16px",
                  borderColor: "var(--tooltip-border)",
                  boxShadow: "var(--tooltip-shadow)",
                }}
              />
              <Area
                type="monotone"
                dataKey="totalSavings"
                stroke="#10b981"
                fill="#d1fae5"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Net Worth */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Net Worth
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Total savings minus total remaining debt
          </p>
        </div>
        <div className="px-6 py-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={netWorthData}
              margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
            >
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => formatChartCurrency(Number(v))}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis-muted)", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [
                  formatChartCurrency(Number(value)),
                  "Net Worth",
                ]}
                contentStyle={{
                  borderRadius: "16px",
                  borderColor: "var(--tooltip-border)",
                  boxShadow: "var(--tooltip-shadow)",
                }}
              />
              <ReferenceLine
                y={0}
                stroke="#a8a29e"
                strokeDasharray="6 4"
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="#57534e"
                strokeWidth={2}
                dot={{ r: 4, fill: "#57534e" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
