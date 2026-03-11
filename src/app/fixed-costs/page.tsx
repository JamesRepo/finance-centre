"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  formatMonthLabel,
  getCurrentMonthValue,
  shiftMonthValue,
} from "@/lib/months";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const housingExpenseTypeOptions = [
  { value: "RENT", label: "Rent" },
  { value: "COUNCIL_TAX", label: "Council tax" },
  { value: "ENERGY", label: "Energy" },
  { value: "WATER", label: "Water" },
  { value: "INTERNET", label: "Internet" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "OTHER", label: "Other" },
] as const;

const frequencyOptions = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
] as const;

const subscriptionFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a subscription name"),
  amount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Amount must be greater than 0"),
  ),
  frequency: z.enum(["MONTHLY", "YEARLY"], {
    message: "Select a frequency",
  }),
  nextPaymentDate: z.string().min(1, "Enter a payment date"),
});

type HousingExpenseType = (typeof housingExpenseTypeOptions)[number]["value"];
type Frequency = (typeof frequencyOptions)[number]["value"];
type SaveState = "idle" | "saving" | "saved" | "error";
type ActiveTab = "housing" | "subscriptions";
type SubscriptionFormValues = z.input<typeof subscriptionFormSchema>;
type SubscriptionFormSubmitValues = z.output<typeof subscriptionFormSchema>;

type HousingExpense = {
  id: number;
  expenseType: HousingExpenseType;
  amount: string;
  expenseMonth: string;
  frequency: Frequency;
  createdAt: string;
};

type HousingRow = {
  expenseType: HousingExpenseType;
  label: string;
  amount: string;
  frequency: Frequency;
  hasStoredValue: boolean;
  previousMonthAmount: string | null;
  previousMonthFrequency: Frequency | null;
};

type Subscription = {
  id: number;
  name: string;
  amount: string;
  frequency: Frequency;
  nextPaymentDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  monthlyEquivalent: string;
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatInputAmount(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return amount.toFixed(2);
}

function calculateMonthlyEquivalent(amount: string, frequency: Frequency) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return frequency === "YEARLY" ? value / 12 : value;
}

function formatDisplayDate(value: string) {
  return format(new Date(value), "d MMM yyyy");
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "dark" | "light";
}) {
  return (
    <div
      className={
        tone === "dark"
          ? "rounded-[1.75rem] bg-stone-950 px-5 py-5 text-white"
          : "rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5 text-stone-950"
      }
    >
      <p
        className={
          tone === "dark"
            ? "text-sm font-medium text-stone-300"
            : "text-sm font-medium text-stone-500"
        }
      >
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default function FixedCostsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("housing");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [housingExpenses, setHousingExpenses] = useState<HousingExpense[]>([]);
  const [previousHousingExpenses, setPreviousHousingExpenses] = useState<
    HousingExpense[]
  >([]);
  const [housingDrafts, setHousingDrafts] = useState<
    Record<HousingExpenseType, string>
  >({} as Record<HousingExpenseType, string>);
  const [housingFrequencyDrafts, setHousingFrequencyDrafts] = useState<
    Record<HousingExpenseType, Frequency>
  >({} as Record<HousingExpenseType, Frequency>);
  const [editingExpenseType, setEditingExpenseType] =
    useState<HousingExpenseType | null>(null);
  const [housingSaveStates, setHousingSaveStates] = useState<
    Record<HousingExpenseType, SaveState>
  >({} as Record<HousingExpenseType, SaveState>);
  const [housingMessages, setHousingMessages] = useState<
    Record<HousingExpenseType, string>
  >({} as Record<HousingExpenseType, string>);
  const [housingLoading, setHousingLoading] = useState(true);
  const [housingError, setHousingError] = useState<string | null>(null);
  const [copyingPreviousMonth, setCopyingPreviousMonth] = useState(false);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);
  const [subscriptionSubmitError, setSubscriptionSubmitError] = useState<
    string | null
  >(null);
  const [subscriptionToggleId, setSubscriptionToggleId] = useState<number | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<
    SubscriptionFormValues,
    undefined,
    SubscriptionFormSubmitValues
  >({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      name: "",
      amount: undefined,
      frequency: "MONTHLY",
      nextPaymentDate: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const monthLabel = useMemo(
    () => formatMonthLabel(selectedMonth),
    [selectedMonth],
  );
  const previousMonth = useMemo(
    () => shiftMonthValue(selectedMonth, -1),
    [selectedMonth],
  );
  const previousMonthLabel = useMemo(
    () => formatMonthLabel(previousMonth),
    [previousMonth],
  );

  async function loadHousingData(month: string) {
    setHousingLoading(true);
    setHousingError(null);

    try {
      const currentResponse = await fetch(`/api/housing?month=${month}`, {
        cache: "no-store",
      });

      if (!currentResponse.ok) {
        throw new Error(
          await readApiError(currentResponse, "Failed to load housing expenses"),
        );
      }

      const previousResponse = await fetch(
        `/api/housing?month=${shiftMonthValue(month, -1)}`,
        {
          cache: "no-store",
        },
      );

      if (!previousResponse.ok) {
        throw new Error(
          await readApiError(
            previousResponse,
            "Failed to load previous housing expenses",
          ),
        );
      }

      const currentData = (await currentResponse.json()) as HousingExpense[];
      const previousData = (await previousResponse.json()) as HousingExpense[];

      setHousingExpenses(currentData);
      setPreviousHousingExpenses(previousData);
      setHousingDrafts(
        Object.fromEntries(
          housingExpenseTypeOptions.map(({ value }) => {
            const currentExpense = currentData.find(
              (expense) => expense.expenseType === value,
            );

            return [value, currentExpense ? formatInputAmount(currentExpense.amount) : ""];
          }),
        ) as Record<HousingExpenseType, string>,
      );
      setHousingFrequencyDrafts(
        Object.fromEntries(
          housingExpenseTypeOptions.map(({ value }) => {
            const currentExpense = currentData.find(
              (expense) => expense.expenseType === value,
            );
            const previousExpense = previousData.find(
              (expense) => expense.expenseType === value,
            );

            return [value, currentExpense?.frequency ?? previousExpense?.frequency ?? "MONTHLY"];
          }),
        ) as Record<HousingExpenseType, Frequency>,
      );
      setHousingSaveStates({} as Record<HousingExpenseType, SaveState>);
      setHousingMessages({} as Record<HousingExpenseType, string>);
      setEditingExpenseType(null);
    } catch (error) {
      setHousingError(
        error instanceof Error ? error.message : "Failed to load housing expenses",
      );
    } finally {
      setHousingLoading(false);
    }
  }

  async function loadSubscriptions() {
    setSubscriptionsLoading(true);
    setSubscriptionsError(null);

    try {
      const response = await fetch("/api/subscriptions", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to load subscriptions"),
        );
      }

      const data = (await response.json()) as Subscription[];
      setSubscriptions(data);
    } catch (error) {
      setSubscriptionsError(
        error instanceof Error ? error.message : "Failed to load subscriptions",
      );
    } finally {
      setSubscriptionsLoading(false);
    }
  }

  useEffect(() => {
    void loadHousingData(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  const housingRows = useMemo<HousingRow[]>(
    () =>
      housingExpenseTypeOptions.map(({ value, label }) => {
        const currentExpense =
          housingExpenses.find((expense) => expense.expenseType === value) ?? null;
        const previousExpense =
          previousHousingExpenses.find((expense) => expense.expenseType === value) ??
          null;

        return {
          expenseType: value,
          label,
          amount: currentExpense?.amount ?? "",
          frequency:
            housingFrequencyDrafts[value] ??
            currentExpense?.frequency ??
            previousExpense?.frequency ??
            "MONTHLY",
          hasStoredValue: currentExpense !== null,
          previousMonthAmount: previousExpense?.amount ?? null,
          previousMonthFrequency: previousExpense?.frequency ?? null,
        };
      }),
    [housingExpenses, housingFrequencyDrafts, previousHousingExpenses],
  );

  const housingTotalMonthly = useMemo(
    () =>
      housingRows.reduce(
        (sum, row) => sum + calculateMonthlyEquivalent(row.amount, row.frequency),
        0,
      ),
    [housingRows],
  );

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.isActive),
    [subscriptions],
  );
  const inactiveSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => !subscription.isActive),
    [subscriptions],
  );
  const subscriptionsTotalMonthly = useMemo(
    () =>
      activeSubscriptions.reduce(
        (sum, subscription) =>
          sum + calculateMonthlyEquivalent(subscription.amount, subscription.frequency),
        0,
      ),
    [activeSubscriptions],
  );
  const combinedFixedCosts = housingTotalMonthly + subscriptionsTotalMonthly;

  const copyableRows = useMemo(
    () =>
      housingRows.filter(
        (row) =>
          !row.hasStoredValue &&
          row.previousMonthAmount !== null &&
          row.previousMonthFrequency !== null,
      ),
    [housingRows],
  );

  async function saveHousingExpense(
    expenseType: HousingExpenseType,
    amount: string,
    frequency: Frequency,
  ) {
    const normalizedAmount = formatInputAmount(amount);
    const existingExpense =
      housingExpenses.find((expense) => expense.expenseType === expenseType) ?? null;
    const originalValue = existingExpense ? formatInputAmount(existingExpense.amount) : "";
    const originalFrequency = existingExpense?.frequency ?? "MONTHLY";

    if (!normalizedAmount) {
      setHousingDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: originalValue,
      }));
      setHousingSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "error",
      }));
      setHousingMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]: "Enter an amount greater than 0",
      }));
      return;
    }

    if (normalizedAmount === originalValue && frequency === originalFrequency) {
      setHousingDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: normalizedAmount,
      }));
      setHousingSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "idle",
      }));
      setHousingMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]: "",
      }));
      return;
    }

    setHousingSaveStates((currentStates) => ({
      ...currentStates,
      [expenseType]: "saving",
    }));
    setHousingMessages((currentMessages) => ({
      ...currentMessages,
      [expenseType]: "Saving...",
    }));

    try {
      const response = await fetch("/api/housing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expenseType,
          month: selectedMonth,
          amount: normalizedAmount,
          frequency,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to save housing expense"),
        );
      }

      const savedExpense = (await response.json()) as HousingExpense;

      setHousingExpenses((currentExpenses) => {
        const otherExpenses = currentExpenses.filter(
          (expense) => expense.expenseType !== expenseType,
        );

        return [...otherExpenses, savedExpense];
      });
      setHousingFrequencyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: savedExpense.frequency,
      }));
      setHousingDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: formatInputAmount(savedExpense.amount),
      }));
      setHousingSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "saved",
      }));
      setHousingMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]: "Saved",
      }));
    } catch (error) {
      setHousingFrequencyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: originalFrequency,
      }));
      setHousingDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: originalValue,
      }));
      setHousingSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "error",
      }));
      setHousingMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]:
          error instanceof Error ? error.message : "Failed to save housing expense",
      }));
    }
  }

  async function handleCopyPreviousMonth() {
    if (copyableRows.length === 0) {
      return;
    }

    setCopyingPreviousMonth(true);

    try {
      await Promise.all(
        copyableRows.map((row) =>
          saveHousingExpense(
            row.expenseType,
            row.previousMonthAmount ?? "",
            row.previousMonthFrequency ?? "MONTHLY",
          ),
        ),
      );
    } finally {
      setCopyingPreviousMonth(false);
    }
  }

  async function handleSubscriptionSubmit(values: SubscriptionFormSubmitValues) {
    setSubscriptionSubmitError(null);

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: values.name.trim(),
          amount: values.amount,
          frequency: values.frequency,
          nextPaymentDate: values.nextPaymentDate,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to add subscription"));
      }

      const subscription = (await response.json()) as Subscription;

      setSubscriptions((currentSubscriptions) => {
        const nextSubscriptions = [...currentSubscriptions, subscription];

        return nextSubscriptions.sort((left, right) => {
          if (left.isActive !== right.isActive) {
            return left.isActive ? -1 : 1;
          }

          return left.name.localeCompare(right.name);
        });
      });
      reset({
        name: "",
        amount: undefined,
        frequency: "MONTHLY",
        nextPaymentDate: format(new Date(), "yyyy-MM-dd"),
      });
    } catch (error) {
      setSubscriptionSubmitError(
        error instanceof Error ? error.message : "Failed to add subscription",
      );
    }
  }

  async function handleSubscriptionToggle(subscription: Subscription) {
    setSubscriptionToggleId(subscription.id);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          isActive: !subscription.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to update subscription"),
        );
      }

      const updatedSubscription = (await response.json()) as Subscription;

      setSubscriptions((currentSubscriptions) =>
        currentSubscriptions
          .map((currentSubscription) =>
            currentSubscription.id === updatedSubscription.id
              ? updatedSubscription
              : currentSubscription,
          )
          .sort((left, right) => {
            if (left.isActive !== right.isActive) {
              return left.isActive ? -1 : 1;
            }

            return left.name.localeCompare(right.name);
          }),
      );
    } catch (error) {
      setSubscriptionsError(
        error instanceof Error ? error.message : "Failed to update subscription",
      );
    } finally {
      setSubscriptionToggleId(null);
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2 text-sm font-medium text-stone-500">
                  <Link href="/" className="transition hover:text-stone-950">
                    Dashboard
                  </Link>
                  <span>/</span>
                  <Link
                    href="/budgets"
                    className="transition hover:text-stone-950"
                  >
                    Budgets
                  </Link>
                </div>
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Fixed costs
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  Housing and subscriptions
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                  Track recurring fixed costs, update housing amounts inline for
                  each month, and keep subscription spending visible in one place.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label="Total Fixed Costs"
                  value={formatCurrency(combinedFixedCosts)}
                  tone="dark"
                />
                <SummaryCard
                  label="Housing Monthly"
                  value={formatCurrency(housingTotalMonthly)}
                  tone="light"
                />
                <SummaryCard
                  label="Subscriptions Monthly"
                  value={formatCurrency(subscriptionsTotalMonthly)}
                  tone="light"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-b border-stone-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setActiveTab("housing")}
              className={
                activeTab === "housing"
                  ? "rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
              }
            >
              Housing expenses
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("subscriptions")}
              className={
                activeTab === "subscriptions"
                  ? "rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
              }
            >
              Subscriptions
            </button>
          </div>

          <div className="px-6 py-6">
            {activeTab === "housing" ? (
              <section className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Housing Expenses
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {monthLabel}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      Click an amount to edit it. Changes save when the field loses
                      focus, and yearly items are converted to monthly for totals.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex w-full flex-col gap-2 sm:w-52">
                      <span className="text-sm font-medium text-stone-700">Month</span>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(event) => setSelectedMonth(event.target.value)}
                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleCopyPreviousMonth()}
                      disabled={copyingPreviousMonth || copyableRows.length === 0}
                      className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                    >
                      {copyingPreviousMonth
                        ? "Copying..."
                        : copyableRows.length === 0
                          ? `Nothing to copy from ${previousMonthLabel}`
                          : `Copy ${copyableRows.length} unchanged from ${previousMonthLabel}`}
                    </button>
                  </div>
                </div>

                {housingError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {housingError}
                  </p>
                ) : null}

                {housingLoading ? (
                  <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-12 text-center text-sm text-stone-500">
                    Loading housing expenses...
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px_120px] gap-3 border-b border-stone-200 bg-stone-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      <p>Expense type</p>
                      <p>Amount</p>
                      <p>Frequency</p>
                      <p>Status</p>
                    </div>

                    <div className="divide-y divide-stone-200">
                      {housingRows.map((row) => {
                        const isEditing = editingExpenseType === row.expenseType;
                        const draftValue = housingDrafts[row.expenseType] ?? "";
                        const status = housingMessages[row.expenseType] ?? "";

                        return (
                          <div
                            key={row.expenseType}
                            className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px_120px] md:items-center"
                          >
                            <div>
                              <p className="font-medium text-stone-950">{row.label}</p>
                              {!row.hasStoredValue && row.previousMonthAmount ? (
                                <p className="mt-1 text-xs text-stone-500">
                                  Last month:{" "}
                                  {formatCurrency(Number(row.previousMonthAmount))} /{" "}
                                  {row.previousMonthFrequency?.toLowerCase()}
                                </p>
                              ) : null}
                            </div>

                            <div>
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={draftValue}
                                  onChange={(event) =>
                                    setHousingDrafts((currentDrafts) => ({
                                      ...currentDrafts,
                                      [row.expenseType]: event.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    setEditingExpenseType(null);
                                    void saveHousingExpense(
                                      row.expenseType,
                                      draftValue,
                                      row.frequency,
                                    );
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }

                                    if (event.key === "Escape") {
                                      setHousingDrafts((currentDrafts) => ({
                                        ...currentDrafts,
                                        [row.expenseType]: formatInputAmount(row.amount),
                                      }));
                                      setEditingExpenseType(null);
                                    }
                                  }}
                                  autoFocus
                                  className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingExpenseType(row.expenseType)}
                                  className="flex h-11 w-full items-center rounded-xl border border-stone-300 bg-white px-3 text-left text-sm text-stone-950 transition hover:border-stone-400"
                                >
                                  {row.amount
                                    ? formatCurrency(Number(row.amount))
                                    : "Click to add amount"}
                                </button>
                              )}
                            </div>

                            <div>
                              <select
                                value={row.frequency}
                                onChange={(event) => {
                                  const nextFrequency = event.target.value as Frequency;

                                  setHousingFrequencyDrafts((currentDrafts) => ({
                                    ...currentDrafts,
                                    [row.expenseType]: nextFrequency,
                                  }));

                                  if (housingDrafts[row.expenseType] || row.amount) {
                                    void saveHousingExpense(
                                      row.expenseType,
                                      housingDrafts[row.expenseType] || row.amount,
                                      nextFrequency,
                                    );
                                  }
                                }}
                                className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                              >
                                {frequencyOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <p
                                className={`text-sm ${
                                  housingSaveStates[row.expenseType] === "error"
                                    ? "text-red-600"
                                    : housingSaveStates[row.expenseType] === "saved"
                                      ? "text-emerald-600"
                                      : "text-stone-500"
                                }`}
                              >
                                {status || "Ready"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-2 border-t border-stone-200 bg-stone-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-stone-600">
                        Total monthly housing cost
                      </p>
                      <p className="text-2xl font-semibold tracking-tight text-stone-950">
                        {formatCurrency(housingTotalMonthly)}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <section className="flex flex-col gap-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
                  <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Subscriptions
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      Recurring subscription spend
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      Active subscriptions contribute to the monthly total. Inactive
                      items stay visible at the bottom for reference.
                    </p>
                  </div>

                  <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5">
                    <p className="text-sm font-medium text-stone-500">
                      Total monthly subscription cost
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
                      {formatCurrency(subscriptionsTotalMonthly)}
                    </p>
                  </div>
                </div>

                {subscriptionsError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {subscriptionsError}
                  </p>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
                  <div className="flex flex-col gap-4">
                    {subscriptionsLoading ? (
                      <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-12 text-center text-sm text-stone-500">
                        Loading subscriptions...
                      </div>
                    ) : (
                      <>
                        {activeSubscriptions.length === 0 ? (
                          <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white px-5 py-12 text-center text-sm text-stone-500">
                            No active subscriptions yet.
                          </div>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2">
                            {activeSubscriptions.map((subscription) => (
                              <article
                                key={subscription.id}
                                className="rounded-[1.75rem] border border-stone-200 bg-white shadow-sm"
                              >
                                <div className="flex h-full flex-col gap-5 px-5 py-5">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-xl font-semibold tracking-tight text-stone-950">
                                        {subscription.name}
                                      </h3>
                                      <p className="mt-1 text-sm text-stone-500">
                                        {frequencyOptions.find(
                                          (option) =>
                                            option.value === subscription.frequency,
                                        )?.label ?? subscription.frequency}
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleSubscriptionToggle(subscription)
                                      }
                                      disabled={subscriptionToggleId === subscription.id}
                                      className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {subscriptionToggleId === subscription.id
                                        ? "Saving"
                                        : "Mark inactive"}
                                    </button>
                                  </div>

                                  <div className="grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                                        Amount
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-stone-950">
                                        {formatCurrency(Number(subscription.amount))}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                                        Monthly equivalent
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-stone-950">
                                        {formatCurrency(
                                          Number(subscription.monthlyEquivalent),
                                        )}
                                      </p>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                                        Next payment date
                                      </p>
                                      <p className="mt-1 font-medium text-stone-950">
                                        {formatDisplayDate(subscription.nextPaymentDate)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}

                        {inactiveSubscriptions.length > 0 ? (
                          <div className="pt-2">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <h3 className="text-lg font-semibold text-stone-950">
                                Inactive subscriptions
                              </h3>
                              <p className="text-sm text-stone-500">
                                Shown for reference
                              </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              {inactiveSubscriptions.map((subscription) => (
                                <article
                                  key={subscription.id}
                                  className="rounded-[1.75rem] border border-stone-200 bg-stone-100 shadow-sm"
                                >
                                  <div className="flex h-full flex-col gap-5 px-5 py-5 text-stone-500">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <h3 className="text-xl font-semibold tracking-tight text-stone-700">
                                          {subscription.name}
                                        </h3>
                                        <p className="mt-1 text-sm">
                                          {frequencyOptions.find(
                                            (option) =>
                                              option.value === subscription.frequency,
                                          )?.label ?? subscription.frequency}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleSubscriptionToggle(subscription)
                                        }
                                        disabled={subscriptionToggleId === subscription.id}
                                        className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {subscriptionToggleId === subscription.id
                                          ? "Saving"
                                          : "Reactivate"}
                                      </button>
                                    </div>

                                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                                          Amount
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-stone-700">
                                          {formatCurrency(Number(subscription.amount))}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                                          Monthly equivalent
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-stone-700">
                                          {formatCurrency(
                                            Number(subscription.monthlyEquivalent),
                                          )}
                                        </p>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                                          Next payment date
                                        </p>
                                        <p className="mt-1 font-medium text-stone-700">
                                          {formatDisplayDate(subscription.nextPaymentDate)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <form
                    className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm"
                    onSubmit={handleSubmit(handleSubscriptionSubmit)}
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Add Subscription
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      New recurring payment
                    </h2>

                    <div className="mt-6 grid gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Name
                        </span>
                        <input
                          type="text"
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                          disabled={isSubmitting}
                          placeholder="Spotify, Gym, iCloud..."
                          {...register("name")}
                        />
                        {errors.name ? (
                          <p className="text-sm text-red-600">{errors.name.message}</p>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Amount
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                          disabled={isSubmitting}
                          placeholder="0.00"
                          {...register("amount")}
                        />
                        {errors.amount ? (
                          <p className="text-sm text-red-600">
                            {errors.amount.message}
                          </p>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Frequency
                        </span>
                        <select
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                          disabled={isSubmitting}
                          {...register("frequency")}
                        >
                          {frequencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {errors.frequency ? (
                          <p className="text-sm text-red-600">
                            {errors.frequency.message}
                          </p>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Next payment date
                        </span>
                        <input
                          type="date"
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                          disabled={isSubmitting}
                          {...register("nextPaymentDate")}
                        />
                        {errors.nextPaymentDate ? (
                          <p className="text-sm text-red-600">
                            {errors.nextPaymentDate.message}
                          </p>
                        ) : null}
                      </label>

                      <button
                        type="submit"
                        className="mt-2 h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Saving..." : "Add subscription"}
                      </button>

                      {subscriptionSubmitError ? (
                        <p className="text-sm text-red-600">
                          {subscriptionSubmitError}
                        </p>
                      ) : null}
                    </div>
                  </form>
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
