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

type DebtPaymentEntry = {
  id: number;
  amount: string;
  interestAmount: string;
  paymentDate: string;
};

type DebtEntry = {
  id: number;
  name: string;
  originalBalance: string;
  isActive: boolean;
  currentBalance: string;
  principalPaid: string;
  debtPayments: DebtPaymentEntry[];
};

type SavingsEntry = {
  id: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  progress: string;
};

type HousingEntry = {
  id: number;
  expenseType: string;
  amount: string;
  frequency: string;
};

type SubscriptionEntry = {
  id: number;
  name: string;
  amount: string;
  frequency: string;
  monthlyEquivalent: string;
};

type SubscriptionSummary = {
  month: string;
  subscriptions: SubscriptionEntry[];
  total: string;
  monthlyEquivalentTotal: string;
};

type IncomeEntry = {
  id: number;
  netAmount: string;
};

type HolidayEntry = {
  id: number;
  name: string;
  destination: string;
  isActive: boolean;
  assignedMonth: string;
  totalCost: string;
  monthlyCost: string;
};

const dailyCategoryNames = [
  "Groceries",
  "Eating Out",
  "Transport",
  "Entertainment",
  "Shopping",
  "Health",
  "Personal Care",
  "Education",
  "Gifts",
  "General",
] as const;

const dailyCategoryOrder: ReadonlyMap<string, number> = new Map(
  dailyCategoryNames.map((name, index) => [name, index]),
);

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number | string) {
  return currencyFormatter.format(Number(value));
}

function formatChartCurrency(value: number) {
  return currencyFormatter.format(value);
}

function readAmount(value: string) {
  return Number(value);
}

function isSameMonth(value: string, month: string) {
  return value.slice(0, 7) === month;
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
        fill="var(--chart-track)"
      />
      {spentWidth > 0 ? (
        <rect
          x={x}
          y={y}
          width={spentWidth}
          height={height}
          rx={radius}
          fill={payload.isOverBudget ? "#fb7185" : "#22d3ee"}
        />
      ) : null}
    </g>
  );
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-8 text-sm text-stone-500">
      {message}
    </div>
  );
}

function CompactSpendList({
  items,
  emptyLabel,
}: {
  items: Array<{ id: number; label: string; value: number }>;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-stone-600">{item.label}</span>
          <span className="font-medium tabular-nums text-stone-950">
            {formatCurrency(item.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);

  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(true);

  const [savings, setSavings] = useState<SavingsEntry[]>([]);
  const [savingsLoading, setSavingsLoading] = useState(true);

  const [housing, setHousing] = useState<HousingEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [fixedCostsLoading, setFixedCostsLoading] = useState(true);

  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);

  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);

  useEffect(() => {
    async function loadBudgets() {
      setBudgetLoading(true);
      setBudgetError(null);

      try {
        const response = await fetch(`/api/budgets?month=${selectedMonth}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, "Failed to load dashboard"));
        }

        setEntries((await response.json()) as BudgetEntry[]);
      } catch (error) {
        setBudgetError(error instanceof Error ? error.message : "Failed to load dashboard");
      } finally {
        setBudgetLoading(false);
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
          setDebts(data.filter((entry) => entry.isActive));
        }
      } catch {
        // Secondary section; fail quietly.
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
          setSavings((await response.json()) as SavingsEntry[]);
        }
      } catch {
        // Secondary section; fail quietly.
      } finally {
        setSavingsLoading(false);
      }
    }

    void loadSavings();
  }, []);

  useEffect(() => {
    async function loadFixedCosts() {
      setFixedCostsLoading(true);

      try {
        const [housingResponse, subscriptionsResponse] = await Promise.all([
          fetch(`/api/housing?month=${selectedMonth}`, { cache: "no-store" }),
          fetch(`/api/subscriptions?month=${selectedMonth}`, { cache: "no-store" }),
        ]);

        if (housingResponse.ok) {
          setHousing((await housingResponse.json()) as HousingEntry[]);
        } else {
          setHousing([]);
        }

        if (subscriptionsResponse.ok) {
          const subscriptionSummary =
            (await subscriptionsResponse.json()) as SubscriptionSummary;
          setSubscriptions(subscriptionSummary.subscriptions);
        } else {
          setSubscriptions([]);
        }
      } catch {
        setHousing([]);
        setSubscriptions([]);
      } finally {
        setFixedCostsLoading(false);
      }
    }

    void loadFixedCosts();
  }, [selectedMonth]);

  useEffect(() => {
    async function loadHolidays() {
      setHolidaysLoading(true);

      try {
        const response = await fetch(`/api/holidays?month=${selectedMonth}`, {
          cache: "no-store",
        });

        if (response.ok) {
          setHolidays((await response.json()) as HolidayEntry[]);
        } else {
          setHolidays([]);
        }
      } catch {
        setHolidays([]);
      } finally {
        setHolidaysLoading(false);
      }
    }

    void loadHolidays();
  }, [selectedMonth]);

  useEffect(() => {
    async function loadIncome() {
      setIncomeLoading(true);

      try {
        const response = await fetch(`/api/income?month=${selectedMonth}`, {
          cache: "no-store",
        });

        if (response.ok) {
          setIncome((await response.json()) as IncomeEntry[]);
        } else {
          setIncome([]);
        }
      } catch {
        setIncome([]);
      } finally {
        setIncomeLoading(false);
      }
    }

    void loadIncome();
  }, [selectedMonth]);

  const dailyChartData = useMemo(() => {
    return buildBudgetChartEntries(
      entries
        .filter((entry) => dailyCategoryOrder.has(entry.category.name))
        .sort(
          (left, right) =>
            (dailyCategoryOrder.get(left.category.name) ?? Number.POSITIVE_INFINITY) -
            (dailyCategoryOrder.get(right.category.name) ?? Number.POSITIVE_INFINITY),
        ),
    );
  }, [entries]);

  const dailySummary = useMemo(() => {
    const budget = dailyChartData.reduce((sum, entry) => sum + entry.budgetAmount, 0);
    const spent = dailyChartData.reduce((sum, entry) => sum + entry.spentAmount, 0);

    return {
      budget,
      spent,
      remaining: budget - spent,
    };
  }, [dailyChartData]);

  const totalHousing = useMemo(
    () => housing.reduce((sum, entry) => sum + readAmount(entry.amount), 0),
    [housing],
  );

  const totalSubscriptions = useMemo(
    () =>
      subscriptions.reduce(
        (sum, entry) => sum + readAmount(entry.monthlyEquivalent),
        0,
      ),
    [subscriptions],
  );

  const fixedCostsTotal = totalHousing + totalSubscriptions;

  const monthlyHolidaySpend = useMemo(
    () => holidays.reduce((sum, holiday) => sum + readAmount(holiday.monthlyCost), 0),
    [holidays],
  );

  const totalDebtRemaining = useMemo(
    () => debts.reduce((sum, debt) => sum + readAmount(debt.currentBalance), 0),
    [debts],
  );

  const monthlyDebtPayments = useMemo(
    () =>
      debts.reduce(
        (sum, debt) =>
          sum +
          debt.debtPayments.reduce(
            (debtSum, payment) =>
              debtSum +
              (isSameMonth(payment.paymentDate, selectedMonth) ? readAmount(payment.amount) : 0),
            0,
          ),
        0,
      ),
    [debts, selectedMonth],
  );

  const totalSaved = useMemo(
    () => savings.reduce((sum, goal) => sum + readAmount(goal.currentAmount), 0),
    [savings],
  );

  const totalMonthlyIncome = useMemo(
    () => income.reduce((sum, entry) => sum + readAmount(entry.netAmount), 0),
    [income],
  );

  const totalOutgoings =
    dailySummary.spent + fixedCostsTotal + monthlyHolidaySpend + monthlyDebtPayments;
  const netPosition = totalMonthlyIncome - totalOutgoings;
  const chartHeight = Math.max(dailyChartData.length * 52, 260);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="app-hero-surface px-6 py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Monthly Overview
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                  {formatMonthLabel(selectedMonth)}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  Daily spending is front and centre, with fixed costs, holidays, debt, and savings kept visible without competing for attention.
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

            <div className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border border-stone-200 bg-white/80 px-5 py-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-stone-500">Total spent across everything</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">
                  {budgetLoading || fixedCostsLoading || holidaysLoading || debtsLoading ? (
                    <span className="text-lg text-stone-400">Loading...</span>
                  ) : (
                    formatCurrency(totalOutgoings)
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/transactions"
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                >
                  View transactions
                </Link>
                <Link
                  href="/budgets"
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
                >
                  Edit budgets
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-6 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_20rem]">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Daily Spending
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                    Budget vs actual
                  </h2>
                </div>
                <Link
                  href="/budgets"
                  className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
                >
                  Manage daily budgets
                </Link>
              </div>

              {budgetError ? (
                <div className="mt-6 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {budgetError}
                </div>
              ) : null}

              {!budgetError ? (
                <div className="mt-6">
                  {budgetLoading ? (
                    <LoadingPanel message="Loading daily spending..." />
                  ) : dailyChartData.length === 0 ? (
                    <LoadingPanel message="No daily spending categories found for this month." />
                  ) : (
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <BarChart
                        data={dailyChartData}
                        layout="vertical"
                        barCategoryGap={16}
                        margin={{ top: 4, right: 20, left: 12, bottom: 4 }}
                      >
                        <XAxis
                          type="number"
                          tickFormatter={(value) => formatChartCurrency(Number(value))}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--chart-axis-muted)", fontSize: 12 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={130}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--chart-axis)", fontSize: 13 }}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--chart-cursor)" }}
                          formatter={(_value, _name, item) => {
                            const payload = item.payload as BudgetChartEntry;

                            return [
                              `${formatChartCurrency(payload.spentAmount)} spent`,
                              `${formatChartCurrency(payload.budgetAmount)} budget`,
                            ];
                          }}
                          labelFormatter={(value) => `${value}`}
                          contentStyle={{
                            borderRadius: "16px",
                            borderColor: "var(--tooltip-border)",
                            boxShadow: "var(--tooltip-shadow)",
                          }}
                        />
                        <Bar
                          dataKey="budgetBarAmount"
                          shape={<BudgetBar />}
                          radius={[10, 10, 10, 10]}
                          isAnimationActive={false}
                        >
                          {dailyChartData.map((entry) => (
                            <Cell key={entry.categoryId} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-stone-100 pt-4">
                <div>
                  <p className="text-sm font-medium text-stone-500">Total daily spending</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
                    {formatCurrency(dailySummary.spent)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-stone-500">Total daily budget</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-stone-950">
                    {formatCurrency(dailySummary.budget)}
                  </p>
                  <p
                    className={`mt-1 text-sm font-medium ${
                      dailySummary.remaining < 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {dailySummary.remaining < 0 ? "Over by" : "Remaining"}{" "}
                    {formatCurrency(Math.abs(dailySummary.remaining))}
                  </p>
                </div>
              </div>
            </div>

            <aside className="grid gap-4 content-start">
              <article className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 px-5 py-5">
                <p className="text-sm font-medium text-emerald-800">Controlled spend</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-950">
                  {formatCurrency(dailySummary.spent)}
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                  This section only includes categories you actively influence day to day.
                </p>
              </article>

              <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-medium text-stone-500">Included categories</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {dailyCategoryNames.join(", ")}
                </p>
              </article>
            </aside>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                Fixed Costs
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                Costs that land every month
              </h2>
            </div>
            <Link
              href="/fixed-costs"
              className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
            >
              Manage fixed costs
            </Link>
          </div>

          {fixedCostsLoading ? (
            <div className="mt-6">
              <LoadingPanel message="Loading fixed costs..." />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-stone-500">Housing</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                      {formatCurrency(totalHousing)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-stone-200 pt-4">
                  <CompactSpendList
                    items={housing.map((entry) => ({
                      id: entry.id,
                      label: formatLabel(entry.expenseType),
                      value: readAmount(entry.amount),
                    }))}
                    emptyLabel="No housing costs recorded for this month."
                  />
                </div>
              </article>

              <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-stone-500">Subscriptions</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                      {formatCurrency(totalSubscriptions)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-stone-200 pt-4">
                  <CompactSpendList
                    items={subscriptions.map((entry) => ({
                      id: entry.id,
                      label: `${entry.name} (${formatLabel(entry.frequency)})`,
                      value: readAmount(entry.monthlyEquivalent),
                    }))}
                    emptyLabel="No subscriptions."
                  />
                </div>
              </article>
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                Holidays
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                Trips and spend so far
              </h2>
            </div>
            <Link
              href="/holidays"
              className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
            >
              Manage holidays
            </Link>
          </div>

          {holidaysLoading ? (
            <div className="mt-6">
              <LoadingPanel message="Loading holidays..." />
            </div>
          ) : holidays.length === 0 ? (
            <p className="mt-6 rounded-[1.5rem] border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500">
              No holidays for this month
            </p>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {holidays.map((holiday) => (
                <article
                  key={holiday.id}
                  className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5"
                >
                  <p className="text-sm font-medium text-stone-500">{holiday.destination}</p>
                  <h3 className="mt-2 text-lg font-semibold text-stone-950">{holiday.name}</h3>
                  <p className="mt-4 text-sm font-medium text-stone-500">Total cost so far</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
                    {formatCurrency(holiday.totalCost)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-stone-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Debt & Savings
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  Debt summary
                </h2>
              </div>
              <Link
                href="/debts"
                className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
              >
                View debts
              </Link>
            </div>

            {debtsLoading ? (
              <div className="mt-6">
                <LoadingPanel message="Loading debts..." />
              </div>
            ) : debts.length === 0 ? (
              <p className="mt-6 text-sm text-stone-500">No active debts.</p>
            ) : (
              <>
                <p className="mt-6 text-3xl font-semibold tracking-tight text-stone-950">
                  {formatCurrency(totalDebtRemaining)}
                </p>
                <p className="mt-1 text-sm text-stone-500">Remaining across active debts</p>

                <div className="mt-5 space-y-4">
                  {debts.map((debt) => {
                    const originalBalance = readAmount(debt.originalBalance);
                    const principalPaid = readAmount(debt.principalPaid);
                    const progress = originalBalance > 0 ? (principalPaid / originalBalance) * 100 : 0;

                    return (
                      <div key={debt.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium text-stone-950">{debt.name}</span>
                          <span className="tabular-nums text-stone-500">
                            {formatCurrency(debt.currentBalance)} left
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Debt & Savings
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  Savings summary
                </h2>
              </div>
              <Link
                href="/savings"
                className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
              >
                View savings
              </Link>
            </div>

            {savingsLoading ? (
              <div className="mt-6">
                <LoadingPanel message="Loading savings..." />
              </div>
            ) : savings.length === 0 ? (
              <p className="mt-6 text-sm text-stone-500">No savings goals yet.</p>
            ) : (
              <>
                <p className="mt-6 text-3xl font-semibold tracking-tight text-stone-950">
                  {formatCurrency(totalSaved)}
                </p>
                <p className="mt-1 text-sm text-stone-500">Saved across all goals</p>

                <div className="mt-5 space-y-4">
                  {savings.map((goal) => (
                    <div key={goal.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-stone-950">{goal.name}</span>
                        <span className="tabular-nums text-stone-500">
                          {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.min(readAmount(goal.progress), 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                Monthly Summary
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                Income vs outgoings
              </h2>
            </div>
            <Link
              href="/income"
              className="text-sm font-medium text-stone-500 transition hover:text-stone-950"
            >
              Manage income
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5">
              <p className="text-sm font-medium text-stone-500">Income</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                {incomeLoading ? "Loading..." : formatCurrency(totalMonthlyIncome)}
              </p>
            </article>

            <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5">
              <p className="text-sm font-medium text-stone-500">Outgoings</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                {budgetLoading || fixedCostsLoading || holidaysLoading || debtsLoading
                  ? "Loading..."
                  : formatCurrency(totalOutgoings)}
              </p>
            </article>

            <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5">
              <p className="text-sm font-medium text-stone-500">Remaining</p>
              <p
                className={`mt-2 text-2xl font-semibold tracking-tight ${
                  netPosition < 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {incomeLoading || budgetLoading || fixedCostsLoading || holidaysLoading || debtsLoading
                  ? "Loading..."
                  : formatCurrency(netPosition)}
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
