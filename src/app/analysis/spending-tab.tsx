"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

type SpendingData = {
  monthlyTotals: Array<{ month: string; total: string }>;
  stackedByMonth: Array<Record<string, unknown>>;
  top5Categories: Array<{
    id: string;
    name: string;
    colorCode: string;
  }>;
  hasOther: boolean;
  categoryChanges: Array<{
    categoryId: string;
    categoryName: string;
    colorCode: string;
    currentTotal: number;
    priorTotal: number;
    change: number;
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

export function SpendingTab({ data }: { data: SpendingData }) {
  const chartData = useMemo(
    () =>
      data.monthlyTotals.map((entry) => ({
        month: formatShortMonth(entry.month),
        total: Number(entry.total),
      })),
    [data.monthlyTotals],
  );

  const average = useMemo(() => {
    if (chartData.length === 0) return 0;
    const sum = chartData.reduce((acc, entry) => acc + entry.total, 0);
    return sum / chartData.length;
  }, [chartData]);

  const stackedData = useMemo(
    () =>
      data.stackedByMonth.map((entry) => ({
        ...entry,
        month: formatShortMonth(entry.month as string),
      })),
    [data.stackedByMonth],
  );

  const categoryKeys = useMemo(() => {
    const keys = data.top5Categories.map((c) => c.name);
    if (data.hasOther) keys.push("Other");
    return keys;
  }, [data.top5Categories, data.hasOther]);

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of data.top5Categories) {
      map[cat.name] = cat.colorCode;
    }
    map["Other"] = "#a8a29e";
    return map;
  }, [data.top5Categories]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
        No spending data found for this period.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Monthly Spending */}
      <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-stone-950">
            Monthly Spending
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
              <ReferenceLine
                y={average}
                stroke="#a8a29e"
                strokeDasharray="6 4"
                label={{
                  value: `Avg ${formatChartCurrency(average)}`,
                  position: "right",
                  fill: "#a8a29e",
                  fontSize: 12,
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

      {/* Category Breakdown (stacked) */}
      {stackedData.length > 0 && categoryKeys.length > 0 && (
        <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-stone-950">
              Category Breakdown
            </h2>
          </div>
          <div className="px-6 py-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={stackedData}
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
                  cursor={{ fill: "var(--chart-cursor)" }}
                  formatter={(value, name) => [
                    formatChartCurrency(Number(value)),
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: "16px",
                    borderColor: "var(--tooltip-border)",
                    boxShadow: "var(--tooltip-shadow)",
                  }}
                />
                {categoryKeys.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="categories"
                    fill={colorMap[key] ?? "#a8a29e"}
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4">
              {categoryKeys.map((key) => (
                <div key={key} className="flex items-center gap-2 text-sm text-stone-700">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: colorMap[key] ?? "#a8a29e" }}
                  />
                  {key}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category Changes */}
      {data.categoryChanges.length > 0 && (
        <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-stone-950">
              Biggest Category Changes
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              vs. prior month
            </p>
          </div>
          <div className="px-6 py-4">
            <div className="divide-y divide-stone-100">
              {data.categoryChanges.map((cat) => (
                <div
                  key={cat.categoryId}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.colorCode }}
                    />
                    <span className="text-sm font-medium text-stone-950">
                      {cat.categoryName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        cat.change > 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {cat.change > 0 ? "\u2191" : "\u2193"}{" "}
                      {currencyFormatter.format(Math.abs(cat.change))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
