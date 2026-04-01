"use client";

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
  paymentDate: z.string().min(1, "Enter a payment date"),
  description: z.string().trim().optional(),
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
  paymentDate: string;
  paymentMonth: string;
  description: string | null;
  createdAt: string;
  monthlyEquivalent: string;
};

type SubscriptionSummary = {
  month: string;
  subscriptions: Subscription[];
  total: string;
  monthlyEquivalentTotal: string;
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

function getDefaultPaymentDate(month: string) {
  return `${month}-01`;
}

function formatPaymentDay(value: string) {
  return format(new Date(value), "d");
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchSubscriptionSummary(month: string) {
  const response = await fetch(`/api/subscriptions?month=${month}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to load subscriptions"));
  }

  return (await response.json()) as SubscriptionSummary;
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

  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary>({
    month: getCurrentMonthValue(),
    subscriptions: [],
    total: "0",
    monthlyEquivalentTotal: "0",
  });
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);
  const [subscriptionSubmitError, setSubscriptionSubmitError] = useState<
    string | null
  >(null);
  const [subscriptionDeleteId, setSubscriptionDeleteId] = useState<number | null>(null);
  const [copyingSubscriptions, setCopyingSubscriptions] = useState(false);
  const [previousMonthSubscriptionCount, setPreviousMonthSubscriptionCount] =
    useState(0);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<number | null>(
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
      paymentDate: getDefaultPaymentDate(selectedMonth),
      description: "",
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

  async function loadSubscriptions(month: string) {
    setSubscriptionsLoading(true);
    setSubscriptionsError(null);

    try {
      const [currentSummary, previousSummary] = await Promise.all([
        fetchSubscriptionSummary(month),
        fetchSubscriptionSummary(shiftMonthValue(month, -1)),
      ]);

      setSubscriptionSummary(currentSummary);
      setPreviousMonthSubscriptionCount(previousSummary.subscriptions.length);
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
    let isCancelled = false;

    async function loadCurrentMonthSubscriptions() {
      setSubscriptionsLoading(true);
      setSubscriptionsError(null);

      try {
        const [currentSummary, previousSummary] = await Promise.all([
          fetchSubscriptionSummary(selectedMonth),
          fetchSubscriptionSummary(shiftMonthValue(selectedMonth, -1)),
        ]);

        if (isCancelled) {
          return;
        }

        setSubscriptionSummary(currentSummary);
        setPreviousMonthSubscriptionCount(previousSummary.subscriptions.length);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setSubscriptionsError(
          error instanceof Error ? error.message : "Failed to load subscriptions",
        );
      } finally {
        if (!isCancelled) {
          setSubscriptionsLoading(false);
        }
      }
    }

    void loadCurrentMonthSubscriptions();

    return () => {
      isCancelled = true;
    };
  }, [selectedMonth]);

  useEffect(() => {
    if (editingSubscriptionId !== null) {
      return;
    }

    reset({
      name: "",
      amount: undefined,
      frequency: "MONTHLY",
      paymentDate: getDefaultPaymentDate(selectedMonth),
      description: "",
    });
  }, [editingSubscriptionId, reset, selectedMonth]);

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

  const subscriptions = subscriptionSummary.subscriptions;
  const subscriptionsTotal = useMemo(
    () => Number(subscriptionSummary.total),
    [subscriptionSummary.total],
  );
  const subscriptionsTotalMonthly = useMemo(
    () => Number(subscriptionSummary.monthlyEquivalentTotal),
    [subscriptionSummary.monthlyEquivalentTotal],
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
      if (!values.paymentDate.startsWith(selectedMonth)) {
        throw new Error("Payment date must be within the selected month");
      }

      const payload = {
        name: values.name.trim(),
        amount: values.amount,
        frequency: values.frequency,
        month: selectedMonth,
        paymentDate: values.paymentDate,
        description: values.description?.trim() || undefined,
      };
      const endpoint =
        editingSubscriptionId === null
          ? "/api/subscriptions"
          : `/api/subscriptions/${editingSubscriptionId}`;
      const response = await fetch(endpoint, {
        method: editingSubscriptionId === null ? "POST" : "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            editingSubscriptionId === null
              ? "Failed to add subscription"
              : "Failed to update subscription",
          ),
        );
      }

      const subscription = (await response.json()) as Subscription;
      const nextSubscriptions =
        editingSubscriptionId === null
          ? [...subscriptions, subscription]
          : subscriptions.map((currentSubscription) =>
              currentSubscription.id === subscription.id
                ? subscription
                : currentSubscription,
            );

      nextSubscriptions.sort(
        (left, right) =>
          new Date(left.paymentDate).getTime() - new Date(right.paymentDate).getTime() ||
          left.name.localeCompare(right.name),
      );

      const total = nextSubscriptions.reduce(
        (sum, currentSubscription) => sum + Number(currentSubscription.amount),
        0,
      );
      const monthlyEquivalentTotal = nextSubscriptions.reduce(
        (sum, currentSubscription) =>
          sum + Number(currentSubscription.monthlyEquivalent),
        0,
      );

      setSubscriptionSummary({
        month: selectedMonth,
        subscriptions: nextSubscriptions,
        total: total.toString(),
        monthlyEquivalentTotal: monthlyEquivalentTotal.toString(),
      });
      setEditingSubscriptionId(null);
      reset({
        name: "",
        amount: undefined,
        frequency: "MONTHLY",
        paymentDate: getDefaultPaymentDate(selectedMonth),
        description: "",
      });
    } catch (error) {
      setSubscriptionSubmitError(
        error instanceof Error
          ? error.message
          : editingSubscriptionId === null
            ? "Failed to add subscription"
            : "Failed to update subscription",
      );
    }
  }

  function handleSubscriptionEdit(subscription: Subscription) {
    setSubscriptionSubmitError(null);
    setEditingSubscriptionId(subscription.id);
    reset({
      name: subscription.name,
      amount: Number(subscription.amount),
      frequency: subscription.frequency,
      paymentDate: format(new Date(subscription.paymentDate), "yyyy-MM-dd"),
      description: subscription.description ?? "",
    });
  }

  function cancelSubscriptionEdit() {
    setEditingSubscriptionId(null);
    setSubscriptionSubmitError(null);
    reset({
      name: "",
      amount: undefined,
      frequency: "MONTHLY",
      paymentDate: getDefaultPaymentDate(selectedMonth),
      description: "",
    });
  }

  async function handleSubscriptionDelete(subscriptionId: number) {
    setSubscriptionDeleteId(subscriptionId);

    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to delete subscription"),
        );
      }

      const nextSubscriptions = subscriptions.filter(
        (subscription) => subscription.id !== subscriptionId,
      );
      const total = nextSubscriptions.reduce(
        (sum, subscription) => sum + Number(subscription.amount),
        0,
      );
      const monthlyEquivalentTotal = nextSubscriptions.reduce(
        (sum, subscription) => sum + Number(subscription.monthlyEquivalent),
        0,
      );

      setSubscriptionSummary({
        month: selectedMonth,
        subscriptions: nextSubscriptions,
        total: total.toString(),
        monthlyEquivalentTotal: monthlyEquivalentTotal.toString(),
      });

      if (editingSubscriptionId === subscriptionId) {
        cancelSubscriptionEdit();
      }
    } catch (error) {
      setSubscriptionsError(
        error instanceof Error ? error.message : "Failed to delete subscription",
      );
    } finally {
      setSubscriptionDeleteId(null);
    }
  }

  async function handleCopySubscriptions(sourceMonth: string, targetMonth: string) {
    setSubscriptionsError(null);
    setCopyingSubscriptions(true);

    try {
      const [sourceSummary, targetSummary] = await Promise.all([
        sourceMonth === selectedMonth
          ? Promise.resolve(subscriptionSummary)
          : fetchSubscriptionSummary(sourceMonth),
        targetMonth === selectedMonth
          ? Promise.resolve(subscriptionSummary)
          : fetchSubscriptionSummary(targetMonth),
      ]);

      const targetNames = new Set(
        targetSummary.subscriptions.map((subscription) => subscription.name),
      );
      const skippedCount = sourceSummary.subscriptions.filter((subscription) =>
        targetNames.has(subscription.name),
      ).length;
      const copiedCount = sourceSummary.subscriptions.length - skippedCount;

      if (sourceSummary.subscriptions.length === 0) {
        return;
      }

      const confirmed = window.confirm(
        `Copy ${copiedCount} subscription${copiedCount === 1 ? "" : "s"} from ${formatMonthLabel(sourceMonth)} to ${formatMonthLabel(targetMonth)}? ${skippedCount} already exist${skippedCount === 1 ? "s" : ""} and will be skipped.`,
      );

      if (!confirmed) {
        return;
      }

      const response = await fetch("/api/subscriptions/copy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceMonth,
          targetMonth,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to copy subscriptions"),
        );
      }

      if (targetMonth === shiftMonthValue(selectedMonth, 1)) {
        setSelectedMonth(targetMonth);
      } else {
        await loadSubscriptions(selectedMonth);
      }
    } catch (error) {
      setSubscriptionsError(
        error instanceof Error ? error.message : "Failed to copy subscriptions",
      );
    } finally {
      setCopyingSubscriptions(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
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
                <div className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Subscriptions
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                        {monthLabel}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        Manage subscriptions month by month, including yearly
                        payments and carry-forward into the next month.
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
                        onClick={() =>
                          void handleCopySubscriptions(
                            selectedMonth,
                            shiftMonthValue(selectedMonth, 1),
                          )
                        }
                        disabled={copyingSubscriptions || subscriptions.length === 0}
                        className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                      >
                        {copyingSubscriptions
                          ? "Copying..."
                          : "Copy to Next Month"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <SummaryCard
                      label="Total Cost This Month"
                      value={formatCurrency(subscriptionsTotal)}
                      tone="dark"
                    />
                    <SummaryCard
                      label="Monthly Equivalent"
                      value={formatCurrency(subscriptionsTotalMonthly)}
                      tone="light"
                    />
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
                    ) : subscriptions.length === 0 ? (
                      <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white px-5 py-12 text-center">
                        <h3 className="text-xl font-semibold tracking-tight text-stone-950">
                          No subscriptions in {monthLabel}
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-stone-500">
                          Add a subscription manually with the form, or copy forward
                          from {previousMonthLabel} if you want to reuse last
                          month&apos;s list.
                        </p>
                        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopySubscriptions(previousMonth, selectedMonth)
                            }
                            disabled={
                              copyingSubscriptions ||
                              previousMonthSubscriptionCount === 0
                            }
                            className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                          >
                            {copyingSubscriptions
                              ? "Copying..."
                              : previousMonthSubscriptionCount === 0
                                ? `Nothing to copy from ${previousMonthLabel}`
                                : `Copy from ${previousMonthLabel}`}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {subscriptions.map((subscription) => (
                          <article
                            key={subscription.id}
                            className="rounded-[1.75rem] border border-stone-200 bg-white shadow-sm"
                          >
                            <div className="flex flex-col gap-5 px-5 py-5">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-xl font-semibold tracking-tight text-stone-950">
                                      {subscription.name}
                                    </h3>
                                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                                      {subscription.frequency.toLowerCase()}
                                    </span>
                                  </div>
                                  {subscription.description ? (
                                    <p className="mt-2 text-sm leading-6 text-stone-500">
                                      {subscription.description}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSubscriptionEdit(subscription)}
                                    className="h-10 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleSubscriptionDelete(subscription.id)
                                    }
                                    disabled={subscriptionDeleteId === subscription.id}
                                    className="h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {subscriptionDeleteId === subscription.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </div>

                              <div className="grid gap-4 text-sm text-stone-600 sm:grid-cols-3">
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
                                    Payment day
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-stone-950">
                                    Day {formatPaymentDay(subscription.paymentDate)}
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
                              </div>

                              <p className="text-sm text-stone-500">
                                Paid on {formatDisplayDate(subscription.paymentDate)}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm"
                    onSubmit={handleSubmit(handleSubscriptionSubmit)}
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {editingSubscriptionId === null
                        ? "Add Subscription"
                        : "Edit Subscription"}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {editingSubscriptionId === null
                        ? "New monthly entry"
                        : "Update monthly entry"}
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
                          Payment date
                        </span>
                        <input
                          type="date"
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                          disabled={isSubmitting}
                          {...register("paymentDate")}
                        />
                        {errors.paymentDate ? (
                          <p className="text-sm text-red-600">
                            {errors.paymentDate.message}
                          </p>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Description
                        </span>
                        <textarea
                          rows={4}
                          className="rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-stone-950"
                          disabled={isSubmitting}
                          placeholder="Optional details"
                          {...register("description")}
                        />
                        {errors.description ? (
                          <p className="text-sm text-red-600">
                            {errors.description.message}
                          </p>
                        ) : null}
                      </label>

                      <div className="mt-2 flex gap-3">
                        <button
                          type="submit"
                          className="h-11 flex-1 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                          disabled={isSubmitting}
                        >
                          {isSubmitting
                            ? "Saving..."
                            : editingSubscriptionId === null
                              ? "Add subscription"
                              : "Save changes"}
                        </button>

                        {editingSubscriptionId !== null ? (
                          <button
                            type="button"
                            onClick={cancelSubscriptionEdit}
                            className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>

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
