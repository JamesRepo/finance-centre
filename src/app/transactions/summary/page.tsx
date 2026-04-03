"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Period = "month" | "year" | "week";

type CategoryEntry = {
  categoryId: string;
  categoryName: string;
  colorCode: string | null;
  total: string;
  transactionCount: number;
};

type WeekBucket = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  total: string;
};

type MonthBucket = {
  month: string;
  total: string;
};

type DayBucket = {
  date: string;
  total: string;
};

type SummaryData = {
  totalSpent: string;
  byCategory: CategoryEntry[];
  byWeek?: WeekBucket[];
  byMonth?: MonthBucket[];
  byDay?: DayBucket[];
  weekStart?: string;
  weekEnd?: string;
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

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

function getTodayDate() {
  return format(new Date(), "yyyy-MM-dd");
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return format(new Date(year, m - 1, 1), "MMMM yyyy");
}

function formatWeekLabel(weekStart: string, weekEnd: string) {
  const start = parseISO(weekStart);
  const end = parseISO(weekEnd);

  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "d")} \u2013 ${format(end, "d MMM yyyy")}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d MMM")} \u2013 ${format(end, "d MMM yyyy")}`;
  }

  return `${format(start, "d MMM yyyy")} \u2013 ${format(end, "d MMM yyyy")}`;
}

function shiftWeek(weekOf: string, days: number) {
  return format(addDays(parseISO(weekOf), days), "yyyy-MM-dd");
}

function formatDayLabel(dateStr: string) {
  return format(parseISO(dateStr), "EEE d");
}

function formatShortMonth(monthStr: string) {
  const [year, m] = monthStr.split("-").map(Number);
  return format(new Date(year, m - 1, 1), "MMM");
}

const periodTabs = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
  { value: "week", label: "Weekly" },
] as const;

export default function TransactionSummaryPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [selectedYear, setSelectedYear] = useState(getCurrentYear);
  const [weekOf, setWeekOf] = useState(getTodayDate);

  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ period });

      if (period === "month") {
        params.set("month", selectedMonth);
      } else if (period === "year") {
        params.set("year", selectedYear);
      } else {
        params.set("weekOf", weekOf);
      }

      const response = await fetch(
        `/api/transactions/summary?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to load summary",
        );
      }

      setData((await response.json()) as SummaryData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load summary",
      );
    } finally {
      setLoading(false);
    }
  }, [period, selectedMonth, selectedYear, weekOf]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const totalSpent = data ? Number(data.totalSpent) : 0;

  const categoryChartData = useMemo(() => {
    if (!data) return [];
    return data.byCategory.map((cat) => ({
      categoryId: cat.categoryId,
      name: cat.categoryName,
      total: Number(cat.total),
      colorCode: cat.colorCode ?? "#a8a29e",
      transactionCount: cat.transactionCount,
    }));
  }, [data]);

  const categoryTableData = useMemo(() => {
    if (!data) return [];
    return data.byCategory.map((cat) => {
      const catTotal = Number(cat.total);
      return {
        categoryId: cat.categoryId,
        name: cat.categoryName,
        colorCode: cat.colorCode ?? "#a8a29e",
        total: catTotal,
        transactionCount: cat.transactionCount,
        percentage: totalSpent > 0 ? (catTotal / totalSpent) * 100 : 0,
      };
    });
  }, [data, totalSpent]);

  const timeChartData = useMemo(() => {
    if (!data) return [];

    if (period === "month" && data.byWeek) {
      return data.byWeek.map((w) => ({
        label: `Wk ${w.weekNumber}`,
        total: Number(w.total),
      }));
    }

    if (period === "year" && data.byMonth) {
      return data.byMonth.map((m) => ({
        label: formatShortMonth(m.month),
        total: Number(m.total),
      }));
    }

    if (period === "week" && data.byDay) {
      return data.byDay.map((d) => ({
        label: formatDayLabel(d.date),
        total: Number(d.total),
      }));
    }

    return [];
  }, [data, period]);

  const categoryChartHeight = Math.max(categoryChartData.length * 48, 200);

  const periodLabel = useMemo(() => {
    if (period === "month") return formatMonthLabel(selectedMonth);
    if (period === "year") return selectedYear;
    if (period === "week" && data?.weekStart && data?.weekEnd) {
      return formatWeekLabel(data.weekStart, data.weekEnd);
    }
    return "";
  }, [period, selectedMonth, selectedYear, data]);

  const timeBreakdownTitle = useMemo(() => {
    if (period === "month") return "Week by week";
    if (period === "year") return "Month by month";
    return "Day by day";
  }, [period]);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {/* Header */}
        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="app-hero-surface border-b border-stone-200 px-6 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Transactions
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                  Spending Summary
                </h1>
              </div>

              <Link
                href="/transactions"
                className="w-fit rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                Back to transactions
              </Link>
            </div>

            {/* Period tabs */}
            <div className="mt-6 flex gap-2">
              {periodTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setPeriod(tab.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    period === tab.value
                      ? "bg-stone-950 text-white"
                      : "border border-stone-300 bg-white text-stone-700 hover:border-stone-950 hover:text-stone-950"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period selector + total */}
          <div className="flex flex-col gap-4 border-b border-stone-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-stone-500">
                {period === "month"
                  ? "Monthly summary"
                  : period === "year"
                    ? "Yearly summary"
                    : "Weekly summary"}
              </p>
              <p className="mt-1 text-lg font-semibold text-stone-950">
                {periodLabel}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {period === "month" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMonth((m) => shiftMonth(m, -1))
                    }
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Previous
                  </button>
                  <input
                    type="month"
                    autoComplete="off"
                    value={selectedMonth}
                    onChange={(e) => {
                      if (e.target.value) setSelectedMonth(e.target.value);
                    }}
                    className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMonth((m) => shiftMonth(m, 1))
                    }
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Next
                  </button>
                </>
              ) : period === "year" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedYear((y) => String(Number(y) - 1))
                    }
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Previous
                  </button>
                  <span className="px-4 text-sm font-semibold text-stone-950">
                    {selectedYear}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedYear((y) => String(Number(y) + 1))
                    }
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setWeekOf((w) => shiftWeek(w, -7))}
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekOf(getTodayDate())}
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    This week
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekOf((w) => shiftWeek(w, 7))}
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Total spent */}
          <div className="px-6 py-6">
            {loading ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                Loading summary...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-stone-500">
                  Total spent
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">
                  {currencyFormatter.format(totalSpent)}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Category breakdown */}
        {!loading && !error && data ? (
          <>
            <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 px-6 py-5">
                <h2 className="text-lg font-semibold text-stone-950">
                  Category Breakdown
                </h2>
              </div>

              {categoryChartData.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-stone-500">
                  No transactions found for this period.
                </div>
              ) : (
                <>
                  {/* Chart */}
                  <div className="px-6 py-6">
                    <ResponsiveContainer
                      width="100%"
                      height={categoryChartHeight}
                    >
                      <BarChart
                        data={categoryChartData}
                        layout="vertical"
                        barCategoryGap={12}
                        margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                      >
                        <XAxis
                          type="number"
                          tickFormatter={(value) =>
                            formatChartCurrency(Number(value))
                          }
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--chart-axis-muted)",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--chart-axis)",
                            fontSize: 13,
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--chart-cursor)" }}
                          formatter={(value) => [
                            formatChartCurrency(Number(value)),
                            "Spent",
                          ]}
                          contentStyle={{
                            borderRadius: "16px",
                            borderColor: "var(--tooltip-border)",
                            boxShadow: "var(--tooltip-shadow)",
                          }}
                        />
                        <Bar
                          dataKey="total"
                          radius={[0, 8, 8, 0]}
                          isAnimationActive={false}
                        >
                          {categoryChartData.map((entry) => (
                            <Cell
                              key={entry.categoryId}
                              fill={entry.colorCode}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto border-t border-stone-200 px-6 py-6">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr className="text-left text-sm text-stone-500">
                          <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                            Category
                          </th>
                          <th className="border-b border-stone-200 pb-3 pr-4 text-right font-medium">
                            Total
                          </th>
                          <th className="border-b border-stone-200 pb-3 pr-4 text-right font-medium">
                            Transactions
                          </th>
                          <th className="border-b border-stone-200 pb-3 text-right font-medium">
                            % of total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryTableData.map((cat) => (
                          <tr
                            key={cat.categoryId}
                            className="text-sm text-stone-700"
                          >
                            <td className="border-b border-stone-100 py-4 pr-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: cat.colorCode,
                                  }}
                                />
                                <span className="font-medium text-stone-950">
                                  {cat.name}
                                </span>
                              </div>
                            </td>
                            <td className="border-b border-stone-100 py-4 pr-4 text-right font-medium tabular-nums text-stone-950">
                              {currencyFormatter.format(cat.total)}
                            </td>
                            <td className="border-b border-stone-100 py-4 pr-4 text-right tabular-nums">
                              {cat.transactionCount}
                            </td>
                            <td className="border-b border-stone-100 py-4 text-right tabular-nums">
                              {cat.percentage.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* Time breakdown */}
            {timeChartData.length > 0 ? (
              <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
                <div className="border-b border-stone-200 px-6 py-5">
                  <h2 className="text-lg font-semibold text-stone-950">
                    {timeBreakdownTitle}
                  </h2>
                </div>

                <div className="px-6 py-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={timeChartData}
                      margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                    >
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--chart-axis)",
                          fontSize: 12,
                        }}
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          formatChartCurrency(Number(value))
                        }
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--chart-axis-muted)",
                          fontSize: 12,
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--chart-cursor)" }}
                        formatter={(value) => [
                          formatChartCurrency(Number(value)),
                          "Spent",
                        ]}
                        contentStyle={{
                          borderRadius: "16px",
                          borderColor: "var(--tooltip-border)",
                          boxShadow: "var(--tooltip-shadow)",
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill="#57534e"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
