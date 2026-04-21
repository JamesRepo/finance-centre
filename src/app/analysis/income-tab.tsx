"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

type IncomeData = {
  incomeVsOutgoings: Array<{
    month: string;
    grossIncome: number;
    income: number;
    outgoings: number;
    netPosition: number;
  }>;
  deductionBreakdown: Array<{
    deductionType: string;
    total: number;
  }>;
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DEDUCTION_COLORS: Record<string, string> = {
  INCOME_TAX: "#f43f5e",
  NI: "#8b5cf6",
  PENSION: "#3b82f6",
  STUDENT_LOAN: "#f59e0b",
  OTHER: "#6b7280",
};

const DEDUCTION_LABELS: Record<string, string> = {
  INCOME_TAX: "Income Tax",
  NI: "National Insurance",
  PENSION: "Pension",
  STUDENT_LOAN: "Student Loan",
  OTHER: "Other",
};

function formatChartCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatShortMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return format(new Date(year, m - 1, 1), "MMM yy");
}

export function IncomeTab({ data }: { data: IncomeData }) {
  const chartData = useMemo(
    () =>
      data.incomeVsOutgoings.map((entry) => ({
        month: formatShortMonth(entry.month),
        income: entry.income,
        outgoings: entry.outgoings,
      })),
    [data.incomeVsOutgoings],
  );

  const netPositionData = useMemo(
    () =>
      data.incomeVsOutgoings.map((entry) => ({
        month: formatShortMonth(entry.month),
        netPosition: entry.netPosition,
      })),
    [data.incomeVsOutgoings],
  );

  const deductionData = useMemo(() => {
    return (data.deductionBreakdown ?? [])
      .filter((d) => d.total > 0)
      .map((d) => ({
        name: DEDUCTION_LABELS[d.deductionType] ?? d.deductionType,
        value: d.total,
        color: DEDUCTION_COLORS[d.deductionType] ?? DEDUCTION_COLORS.OTHER,
      }));
  }, [data.deductionBreakdown]);

  const totalDeductions = useMemo(
    () => deductionData.reduce((sum, d) => sum + d.value, 0),
    [deductionData],
  );

  const grossIncome = useMemo(
    () => data.incomeVsOutgoings.reduce((sum, e) => sum + e.grossIncome, 0),
    [data.incomeVsOutgoings],
  );

  const grossBreakdownData = useMemo(() => {
    if (deductionData.length === 0) return [];

    const takeHome = grossIncome - totalDeductions;
    if (takeHome < 0) return [];

    return [
      { name: "Take-home", value: takeHome, color: "#10b981" },
      ...deductionData,
    ];
  }, [grossIncome, totalDeductions, deductionData]);

  if (data.incomeVsOutgoings.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
        No income data found for this period.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Income vs Outgoings */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Income vs Outgoings
          </h2>
        </div>
        <div className="px-6 py-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
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
                formatter={(value, name) => [
                  formatChartCurrency(Number(value)),
                  name === "income" ? "Income" : "Outgoings",
                ]}
                contentStyle={{
                  borderRadius: "16px",
                  borderColor: "var(--tooltip-border)",
                  boxShadow: "var(--tooltip-shadow)",
                }}
              />
              <Bar
                dataKey="income"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="outgoings"
                fill="#ef4444"
                radius={[8, 8, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 flex gap-6">
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
              Income
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              Outgoings
            </div>
          </div>
        </div>
      </section>

      {/* Net Position */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Net Position
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Monthly surplus or deficit
          </p>
        </div>
        <div className="px-6 py-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={netPositionData}
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
                  "Net Position",
                ]}
                contentStyle={{
                  borderRadius: "16px",
                  borderColor: "var(--tooltip-border)",
                  boxShadow: "var(--tooltip-shadow)",
                }}
              />
              <Bar
                dataKey="netPosition"
                radius={[8, 8, 0, 0]}
                isAnimationActive={false}
              >
                {netPositionData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.netPosition >= 0 ? "#10b981" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Income Deductions Breakdown */}
      {deductionData.length > 0 && (
        <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-stone-950">
              Income Deductions Breakdown
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Where your gross income goes before it reaches you
            </p>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* Deductions breakdown donut */}
              <div className="flex flex-col items-center">
                <p className="mb-2 text-sm font-medium text-stone-700">
                  Deduction Types
                </p>
                <div className="relative">
                  <ResponsiveContainer width={300} height={300}>
                    <PieChart>
                      <Pie
                        data={deductionData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={80}
                        outerRadius={130}
                        paddingAngle={2}
                        isAnimationActive={false}
                      >
                        {deductionData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          formatChartCurrency(Number(value)),
                        ]}
                        contentStyle={{
                          borderRadius: "16px",
                          borderColor: "var(--tooltip-border)",
                          boxShadow: "var(--tooltip-shadow)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-stone-500">Total</p>
                      <p className="text-lg font-semibold text-stone-950" data-testid="deduction-total">
                        {formatChartCurrency(totalDeductions)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
                  {deductionData.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex items-center gap-2 text-sm text-stone-700"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span>{entry.name}</span>
                      <span className="text-stone-400">
                        {formatChartCurrency(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gross income split donut */}
              {grossBreakdownData.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="mb-2 text-sm font-medium text-stone-700">
                    Gross Income Split
                  </p>
                  <div className="relative">
                    <ResponsiveContainer width={300} height={300}>
                      <PieChart>
                        <Pie
                          data={grossBreakdownData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={80}
                          outerRadius={130}
                          paddingAngle={2}
                          isAnimationActive={false}
                        >
                          {grossBreakdownData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            formatChartCurrency(Number(value)),
                          ]}
                          contentStyle={{
                            borderRadius: "16px",
                            borderColor: "var(--tooltip-border)",
                            boxShadow: "var(--tooltip-shadow)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm text-stone-500">Gross</p>
                        <p className="text-lg font-semibold text-stone-950" data-testid="gross-total">
                          {formatChartCurrency(grossIncome)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
                    {grossBreakdownData.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex items-center gap-2 text-sm text-stone-700"
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span>{entry.name}</span>
                        <span className="text-stone-400">
                          {formatChartCurrency(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
