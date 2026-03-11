"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatMonthLabel,
  getCurrentMonthValue,
  shiftMonthValue,
} from "@/lib/months";
import { buildBudgetChartEntries, type BudgetChartEntry } from "./budget-chart-helpers";

type BudgetCategory = {
  id: string;
  name: string;
  colorCode: string | null;
};

type BudgetEntry = {
  categoryId: string;
  amount: string;
  spent: string;
  category: BudgetCategory;
};

type DebtEntry = {
  id: number;
  name: string;
  originalBalance: string;
  isActive: boolean;
  currentBalance: string;
  principalPaid: string;
};

type SavingsEntry = {
  id: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  progress: string;
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

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function BudgetBar({
  x,
  y,
  width,
  height,
  payload,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: BudgetChartEntry;
}) {
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    !payload
  ) {
    return null;
  }

  const radius = Math.min(height / 2, 10);
  const spentWidth = payload.spentFillRatio * width;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={Math.max(width, 0)}
        height={height}
        rx={radius}
        fill="#e7e5e4"
      />
      {spentWidth > 0 ? (
        <rect
          x={x}
          y={y}
          width={spentWidth}
          height={height}
          rx={radius}
          fill={payload.isOverBudget ? "#dc2626" : "#16a34a"}
        />
      ) : null}
    </g>
  );
}

export default function Home() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(true);

  const [savings, setSavings] = useState<SavingsEntry[]>([]);
  const [savingsLoading, setSavingsLoading] = useState(true);

  useEffect(() => {
    async function loadBudgets() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/budgets?month=${selectedMonth}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, "Failed to load dashboard"));
        }

        const data = (await response.json()) as BudgetEntry[];
        setEntries(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load dashboard",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadBudgets();
  }, [selectedMonth]);

  useEffect(() => {
    async function loadDebts() {
      try {
        const response = await fetch("/api/debts", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as DebtEntry[];
          setDebts(data.filter((d) => d.isActive));
        }
      } catch {
        // Silently fail — debts are secondary info
      } finally {
        setDebtsLoading(false);
      }
    }

    void loadDebts();
  }, []);

  useEffect(() => {
    async function loadSavings() {
      try {
        const response = await fetch("/api/savings", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as SavingsEntry[];
          setSavings(data);
        }
      } catch {
        // Silently fail — savings are secondary info
      } finally {
        setSavingsLoading(false);
      }
    }

    void loadSavings();
  }, []);

  const chartData = useMemo(() => buildBudgetChartEntries(entries), [entries]);

  const summary = useMemo(() => {
    const totalBudgeted = chartData.reduce(
      (sum, entry) => sum + entry.budgetAmount,
      0,
    );
    const totalSpent = chartData.reduce((sum, entry) => sum + entry.spentAmount, 0);

    return {
      totalBudgeted,
      totalSpent,
      remaining: totalBudgeted - totalSpent,
    };
  }, [chartData]);

  const totalDebtRemaining = useMemo(
    () => debts.reduce((sum, d) => sum + Number(d.currentBalance), 0),
    [debts],
  );

  const totalSaved = useMemo(
    () => savings.reduce((sum, s) => sum + Number(s.currentAmount), 0),
    [savings],
  );

  const chartHeight = Math.max(chartData.length * 56, 240);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 bg-[linear-gradient(135deg,#fafaf9_0%,#f5f5f4_52%,#ede9e7_100%)] px-6 py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Finance Centre
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                  Monthly budget dashboard
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  Compare plan versus spend across every category in a single view.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMonth((currentMonth) =>
                        shiftMonthValue(currentMonth, -1),
                      )
                    }
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMonth((currentMonth) =>
                        shiftMonthValue(currentMonth, 1),
                      )
                    }
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
                  >
                    Next
                  </button>
                </div>

                <label className="flex min-w-44 flex-col gap-2">
                  <span className="text-sm font-medium text-stone-700">Month</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/budgets"
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                Edit budgets
              </Link>
              <Link
                href="/transactions"
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                View transactions
              </Link>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-stone-500">
                  {formatMonthLabel(selectedMonth)}
                </p>
                <p className="mt-1 text-lg font-semibold text-stone-950">
                  Budget versus spend
                </p>
              </div>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {!error ? (
              <div className="mt-6">
                {loading ? (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-sm text-stone-500">
                    Loading dashboard...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      barCategoryGap={16}
                      margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(value) => formatChartCurrency(Number(value))}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#78716c", fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#292524", fontSize: 13 }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(231, 229, 228, 0.55)" }}
                        formatter={(value, _name, item) => {
                          const payload = item.payload as BudgetChartEntry;

                          return [
                            `${formatChartCurrency(Number(value))} spent`,
                            `${formatChartCurrency(payload.budgetAmount)} budget`,
                          ];
                        }}
                        labelFormatter={(value) => `${value}`}
                        contentStyle={{
                          borderRadius: "16px",
                          borderColor: "#d6d3d1",
                          boxShadow: "0 8px 24px rgba(28, 25, 23, 0.08)",
                        }}
                      />
                      <Bar
                        dataKey="budgetBarAmount"
                        shape={<BudgetBar />}
                        radius={[10, 10, 10, 10]}
                        isAnimationActive={false}
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.categoryId} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Total budgeted</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
              {currencyFormatter.format(summary.totalBudgeted)}
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Total spent</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
              {currencyFormatter.format(summary.totalSpent)}
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Remaining</p>
            <p
              className={`mt-3 text-3xl font-semibold tracking-tight ${
                summary.remaining < 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {currencyFormatter.format(summary.remaining)}
            </p>
          </article>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-950">Debt Payoff</h2>
              <Link
                href="/debts"
                className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
              >
                View all
              </Link>
            </div>

            {debtsLoading ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                Loading debts...
              </div>
            ) : debts.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">No active debts.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-col gap-4">
                  {debts.map((debt) => {
                    const original = Number(debt.originalBalance);
                    const paid = Number(debt.principalPaid);
                    const pctPaid = original > 0 ? Math.min((paid / original) * 100, 100) : 0;

                    return (
                      <div key={debt.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-stone-950">{debt.name}</p>
                          <p className="text-sm tabular-nums text-stone-500">
                            {currencyFormatter.format(Number(debt.currentBalance))} left
                          </p>
                        </div>
                        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-200">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${pctPaid}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-stone-400">
                          {pctPaid.toFixed(0)}% paid off
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-stone-100 pt-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium text-stone-500">Total remaining</p>
                    <p className="text-lg font-semibold tabular-nums text-stone-950">
                      {currencyFormatter.format(totalDebtRemaining)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-950">Savings Goals</h2>
              <Link
                href="/savings"
                className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
              >
                View all
              </Link>
            </div>

            {savingsLoading ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                Loading savings...
              </div>
            ) : savings.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">No savings goals yet.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-col gap-4">
                  {savings.map((goal) => {
                    const progressPct = Math.min(Number(goal.progress), 100);

                    return (
                      <div key={goal.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-stone-950">{goal.name}</p>
                          <p className="text-sm tabular-nums text-stone-500">
                            {currencyFormatter.format(Number(goal.currentAmount))} / {currencyFormatter.format(Number(goal.targetAmount))}
                          </p>
                        </div>
                        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-200">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-stone-400">
                          {progressPct.toFixed(0)}%
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-stone-100 pt-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium text-stone-500">Total saved</p>
                    <p className="text-lg font-semibold tabular-nums text-green-600">
                      {currencyFormatter.format(totalSaved)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
