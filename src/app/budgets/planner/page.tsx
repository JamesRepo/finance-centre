"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

type Cadence = "MONTHLY" | "YEARLY";
type Stream =
  | "SPENDING"
  | "CATEGORY"
  | "HOUSING"
  | "SUBSCRIPTION"
  | "HOLIDAY"
  | "DEBT"
  | "SAVINGS"
  | "INCOME";

type BudgetPlanListEntry = {
  id: number;
  name: string;
  startMonth: string;
  endMonth: string;
  itemCount: number;
};

type BudgetPlanItem = {
  id: number;
  stream: Stream;
  streamLabel: string;
  label: string;
  amount: string;
  cadence: Cadence;
  colorCode: string | null;
  sortOrder: number;
  isCustom: boolean;
  enabled: boolean;
  monthlyEquivalent: number;
  periodTotal: number;
};

type MonthlyCashflow = {
  month: string;
  income: number;
  spending: number;
  debtPayments: number;
  savings: number;
  outgoings: number;
  netPosition: number;
};

type BudgetPlan = {
  id: number;
  name: string;
  startMonth: string;
  endMonth: string;
  items: BudgetPlanItem[];
  monthlyCashflow: MonthlyCashflow[];
  summary: {
    income: number;
    spending: number;
    debtPayments: number;
    savings: number;
    outgoings: number;
    netPosition: number;
    averageMonthlyNet: number;
  };
};

const streamOptions: Array<{ value: Stream; label: string }> = [
  { value: "CATEGORY", label: "Spending" },
  { value: "SPENDING", label: "Spending total" },
  { value: "HOUSING", label: "Housing" },
  { value: "SUBSCRIPTION", label: "Subscriptions" },
  { value: "HOLIDAY", label: "Holidays" },
  { value: "DEBT", label: "Debts" },
  { value: "SAVINGS", label: "Savings" },
  { value: "INCOME", label: "Income" },
];

const streamOrder: Stream[] = [
  "INCOME",
  "CATEGORY",
  "SPENDING",
  "HOUSING",
  "SUBSCRIPTION",
  "HOLIDAY",
  "DEBT",
  "SAVINGS",
];

const sliderDefaults: Record<Stream, { MONTHLY: number; YEARLY: number }> = {
  INCOME: { MONTHLY: 10000, YEARLY: 120000 },
  SPENDING: { MONTHLY: 3000, YEARLY: 36000 },
  CATEGORY: { MONTHLY: 3000, YEARLY: 36000 },
  HOUSING: { MONTHLY: 5000, YEARLY: 60000 },
  SUBSCRIPTION: { MONTHLY: 1000, YEARLY: 12000 },
  HOLIDAY: { MONTHLY: 2000, YEARLY: 20000 },
  DEBT: { MONTHLY: 3000, YEARLY: 36000 },
  SAVINGS: { MONTHLY: 5000, YEARLY: 60000 },
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatInputAmount(value: string | number) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "0.00";
  }

  return amount.toFixed(2);
}

function getDefaultEndMonth(startMonth: string) {
  return shiftMonthValue(startMonth, 11);
}

function sliderMax(item: BudgetPlanItem) {
  const value = Number(item.amount);
  const base = sliderDefaults[item.stream][item.cadence];

  if (!Number.isFinite(value) || value <= base) {
    return base;
  }

  return Math.ceil((value * 1.25) / 100) * 100;
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 max-w-full overflow-hidden whitespace-nowrap text-[clamp(1.45rem,2.2vw,2rem)] font-semibold leading-none text-stone-950">
        {value}
      </p>
    </div>
  );
}

export default function BudgetPlannerPage() {
  const currentMonth = getCurrentMonthValue();
  const sliderSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [plans, setPlans] = useState<BudgetPlanListEntry[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "Long-term budget plan",
    startMonth: currentMonth,
    endMonth: getDefaultEndMonth(currentMonth),
  });

  async function loadPlans(nextSelectedPlanId?: number | null) {
    setLoadingPlans(true);
    setPageError(null);

    try {
      const response = await fetch("/api/budget-plans", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load plans"));
      }

      const data = (await response.json()) as BudgetPlanListEntry[];
      setPlans(data);

      const requestedPlanId =
        nextSelectedPlanId === undefined ? selectedPlanId : nextSelectedPlanId;
      const fallbackPlanId = data[0]?.id ?? null;
      const nextPlanId =
        requestedPlanId !== null &&
        data.some((savedPlan) => savedPlan.id === requestedPlanId)
          ? requestedPlanId
          : fallbackPlanId;

      setSelectedPlanId(nextPlanId);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load plans");
    } finally {
      setLoadingPlans(false);
    }
  }

  async function loadPlan(planId: number) {
    setLoadingPlan(true);
    setPageError(null);

    try {
      const response = await fetch(`/api/budget-plans/${planId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load plan"));
      }

      const data = (await response.json()) as BudgetPlan;
      setPlan(data);
      setPlanForm({
        name: data.name,
        startMonth: data.startMonth,
        endMonth: data.endMonth,
      });
      setDrafts(
        Object.fromEntries(
          data.items.map((item) => [item.id, formatInputAmount(item.amount)]),
        ),
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load plan");
    } finally {
      setLoadingPlan(false);
    }
  }

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timers = sliderSaveTimers.current;

    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPlanId !== null) {
      void loadPlan(selectedPlanId);
    } else {
      setPlan(null);
    }
  }, [selectedPlanId]);

  const groupedItems = useMemo(() => {
    if (!plan) return [];

    return streamOrder
      .map((stream) => ({
        stream,
        label:
          plan.items.find((item) => item.stream === stream)?.streamLabel ??
          streamOptions.find((option) => option.value === stream)?.label ??
          stream,
        items: plan.items
          .filter((item) => item.stream === stream)
          .sort((left, right) => left.sortOrder - right.sortOrder),
      }))
      .filter((group) => group.items.length > 0);
  }, [plan]);

  const planItems = useMemo(
    () => groupedItems.flatMap((group) => group.items),
    [groupedItems],
  );

  const chartData = useMemo(
    () =>
      plan?.monthlyCashflow.map((entry) => ({
        ...entry,
        monthLabel: formatMonthLabel(entry.month).slice(0, 3),
      })) ?? [],
    [plan],
  );

  async function createPlan() {
    setPageError(null);

    try {
      const response = await fetch("/api/budget-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(planForm),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create plan"));
      }

      const createdPlan = (await response.json()) as BudgetPlan;
      await loadPlans(createdPlan.id);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to create plan");
    }
  }

  async function savePlanDetails() {
    if (!plan) return;

    setPageError(null);

    try {
      const response = await fetch(`/api/budget-plans/${plan.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(planForm),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save plan"));
      }

      const updatedPlan = (await response.json()) as BudgetPlan;
      setPlan(updatedPlan);
      await loadPlans(updatedPlan.id);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save plan");
    }
  }

  async function updateItem(item: BudgetPlanItem, patch: Partial<BudgetPlanItem>) {
    if (!plan) return;

    setSavingItemId(item.id);
    setPageError(null);

    try {
      const response = await fetch(`/api/budget-plans/${plan.id}/items/${item.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save item"));
      }

      const updatedPlan = (await response.json()) as BudgetPlan;
      setPlan(updatedPlan);
      setDrafts(
        Object.fromEntries(
          updatedPlan.items.map((updatedItem) => [
            updatedItem.id,
            formatInputAmount(updatedItem.amount),
          ]),
        ),
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save item");
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [item.id]: formatInputAmount(item.amount),
      }));
    } finally {
      setSavingItemId(null);
    }
  }

  async function saveItemAmount(item: BudgetPlanItem) {
    const pendingTimer = sliderSaveTimers.current[item.id];
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      delete sliderSaveTimers.current[item.id];
    }

    const normalizedAmount = formatInputAmount(drafts[item.id] ?? item.amount);

    if (normalizedAmount === formatInputAmount(item.amount)) {
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [item.id]: normalizedAmount,
      }));
      return;
    }

    await updateItem(item, { amount: normalizedAmount } as Partial<BudgetPlanItem>);
  }

  function scheduleItemAmountSave(item: BudgetPlanItem, value: string) {
    const pendingTimer = sliderSaveTimers.current[item.id];
    if (pendingTimer) {
      clearTimeout(pendingTimer);
    }

    sliderSaveTimers.current[item.id] = setTimeout(() => {
      delete sliderSaveTimers.current[item.id];
      void updateItem(item, {
        amount: formatInputAmount(value),
      } as Partial<BudgetPlanItem>);
    }, 350);
  }

  async function deletePlan() {
    const planId = selectedPlanId ?? plan?.id;

    if (!planId) return;

    setPageError(null);

    try {
      const response = await fetch(`/api/budget-plans/${planId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete plan"));
      }

      setSelectedPlanId(null);
      setPlan(null);
      setDrafts({});
      await loadPlans(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to delete plan");
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Budget planner
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Long-term budget scenarios
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                Build saved planning scenarios across spending, housing,
                subscriptions, holidays, debt, savings, and income.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Plan</span>
                <select
                  value={selectedPlanId ?? ""}
                  onChange={(event) =>
                    setSelectedPlanId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  disabled={loadingPlans || plans.length === 0}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                >
                  {plans.length === 0 ? (
                    <option value="">No saved plans</option>
                  ) : (
                    plans.map((savedPlan) => (
                      <option key={savedPlan.id} value={savedPlan.id}>
                        {savedPlan.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void createPlan()}
                className="h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                New plan
              </button>
              {selectedPlanId !== null ? (
                <button
                  type="button"
                  onClick={() => void deletePlan()}
                  className="h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Delete plan
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {pageError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </p>
        ) : null}

        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_170px_170px_auto_auto] lg:items-end">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Plan name</span>
              <input
                type="text"
                value={planForm.name}
                onChange={(event) =>
                  setPlanForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Start</span>
              <input
                type="month"
                value={planForm.startMonth}
                onChange={(event) =>
                  setPlanForm((current) => ({
                    ...current,
                    startMonth: event.target.value,
                  }))
                }
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">End</span>
              <input
                type="month"
                value={planForm.endMonth}
                onChange={(event) =>
                  setPlanForm((current) => ({
                    ...current,
                    endMonth: event.target.value,
                  }))
                }
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
            </label>
            <button
              type="button"
              onClick={() => void (plan ? savePlanDetails() : createPlan())}
              className="h-11 rounded-xl border border-stone-950 px-4 text-sm font-semibold text-stone-950 transition hover:bg-stone-950 hover:text-white"
            >
              {plan ? "Save details" : "Create plan"}
            </button>
          </div>
          {selectedPlanId !== null ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-red-700">
                  Delete this saved planner scenario.
                </p>
                <button
                  type="button"
                  onClick={() => void deletePlan()}
                  className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Delete plan
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {loadingPlan || loadingPlans ? (
          <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-8 text-sm text-stone-500 shadow-sm">
            Loading planner...
          </section>
        ) : null}

        {!loadingPlan && !loadingPlans && !plan ? (
          <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-8 text-sm text-stone-600 shadow-sm">
            Create a plan to start adjusting long-term budgets.
          </section>
        ) : null}

        {plan ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <SummaryCard
                label="Average monthly net"
                value={formatCurrency(plan.summary.averageMonthlyNet)}
              />
              <SummaryCard
                label="Period net"
                value={formatCurrency(plan.summary.netPosition)}
              />
              <SummaryCard
                label="Income"
                value={formatCurrency(plan.summary.income)}
              />
              <SummaryCard
                label="Outgoings"
                value={formatCurrency(plan.summary.outgoings)}
              />
              <SummaryCard
                label="Savings"
                value={formatCurrency(plan.summary.savings)}
              />
              <SummaryCard
                label="Debt"
                value={formatCurrency(plan.summary.debtPayments)}
              />
            </div>

            <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950">
                    Monthly cashflow
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {formatMonthLabel(plan.startMonth)} to{" "}
                    {formatMonthLabel(plan.endMonth)}
                  </p>
                </div>
              </div>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="monthLabel" stroke="#78716c" fontSize={12} />
                    <YAxis stroke="#78716c" fontSize={12} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(_, payload) =>
                        payload[0]
                          ? formatMonthLabel(
                              (payload[0].payload as MonthlyCashflow).month,
                            )
                          : ""
                      }
                    />
                    <Bar dataKey="income" name="Income" fill="#0f766e" />
                    <Bar dataKey="outgoings" name="Outgoings" fill="#f97316" />
                    <Bar dataKey="netPosition" name="Net" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 px-6 py-5">
                <h2 className="text-lg font-semibold text-stone-950">
                  Group budgets
                </h2>
              </div>

              <div className="flex flex-col gap-4 p-6">
                {planItems.map((item) => {
                  const draftAmount = drafts[item.id] ?? item.amount;

                  return (
                    <div
                      key={item.id}
                      className={`grid gap-4 rounded-2xl border px-4 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(180px,1fr)_120px_120px_96px] lg:items-center ${
                        item.enabled
                          ? "border-stone-200 bg-stone-50"
                          : "border-stone-200 bg-stone-100 opacity-70"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full bg-stone-400"
                            style={{
                              backgroundColor: item.colorCode ?? "#a8a29e",
                            }}
                          />
                          <p className="truncate text-sm font-semibold text-stone-950">
                            {item.label}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-stone-500">
                          Monthly equivalent: {formatCurrency(item.monthlyEquivalent)}
                        </p>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max={sliderMax(item)}
                        step={item.cadence === "YEARLY" ? "50" : "10"}
                        value={Math.min(Number(draftAmount || "0"), sliderMax(item))}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [item.id]: nextValue,
                          }));
                          scheduleItemAmountSave(item, nextValue);
                        }}
                        onBlur={() => void saveItemAmount(item)}
                        disabled={!item.enabled}
                        className="w-full accent-stone-950"
                        aria-label={`${item.label} amount`}
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={draftAmount}
                        onChange={(event) =>
                          setDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [item.id]: event.target.value,
                          }))
                        }
                        onBlur={() => void saveItemAmount(item)}
                        disabled={!item.enabled}
                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                      />

                      <select
                        value={item.cadence}
                        onChange={(event) =>
                          void updateItem(item, {
                            cadence: event.target.value as Cadence,
                          } as Partial<BudgetPlanItem>)
                        }
                        disabled={!item.enabled}
                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>

                      <label className="flex items-center gap-2 text-sm text-stone-600">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(event) =>
                            void updateItem(item, {
                              enabled: event.target.checked,
                            } as Partial<BudgetPlanItem>)
                          }
                          disabled={savingItemId === item.id}
                          className="h-4 w-4 accent-stone-950"
                        />
                        Active
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
