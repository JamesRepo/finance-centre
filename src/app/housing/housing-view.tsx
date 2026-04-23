"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatMonthLabel,
  getCurrentMonthValue,
  shiftMonthValue,
} from "@/lib/months";
import { MonthSelector } from "../month-selector";

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

type HousingExpenseType = (typeof housingExpenseTypeOptions)[number]["value"];
type Frequency = (typeof frequencyOptions)[number]["value"];
type SaveState = "idle" | "saving" | "saved" | "error";

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
  hasStoredValue: boolean;
  previousMonthAmount: string | null;
  previousMonthFrequency: Frequency | null;
  draftAmount: string;
  draftFrequency: Frequency;
  monthlyEquivalent: number;
  isDirty: boolean;
  isValidAmount: boolean;
  isSaving: boolean;
  statusText: string;
  statusTone: "default" | "success" | "error";
  validationMessage: string | null;
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function parsePositiveAmount(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function formatInputAmount(value: string) {
  const amount = parsePositiveAmount(value);

  if (amount === null) {
    return "";
  }

  return amount.toFixed(2);
}

function calculateMonthlyEquivalent(amount: string, frequency: Frequency) {
  const value = parsePositiveAmount(amount);

  if (value === null) {
    return 0;
  }

  return frequency === "YEARLY" ? value / 12 : value;
}

function getComparisonValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const normalized = formatInputAmount(trimmedValue);

  return normalized || `invalid:${trimmedValue}`;
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchHousingExpenses(month: string) {
  const response = await fetch(`/api/housing?month=${month}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Failed to load housing expenses"),
    );
  }

  return (await response.json()) as HousingExpense[];
}

function getBaseFrequency(
  currentExpense: HousingExpense | null,
  previousExpense: HousingExpense | null,
) {
  return currentExpense?.frequency ?? previousExpense?.frequency ?? "MONTHLY";
}

function buildInitialDrafts(expenses: HousingExpense[]) {
  return Object.fromEntries(
    housingExpenseTypeOptions.map(({ value }) => {
      const expense = expenses.find((item) => item.expenseType === value);

      return [value, expense ? formatInputAmount(expense.amount) : ""];
    }),
  ) as Record<HousingExpenseType, string>;
}

function buildInitialFrequencyDrafts(
  currentExpenses: HousingExpense[],
  previousExpenses: HousingExpense[],
) {
  return Object.fromEntries(
    housingExpenseTypeOptions.map(({ value }) => {
      const currentExpense =
        currentExpenses.find((expense) => expense.expenseType === value) ?? null;
      const previousExpense =
        previousExpenses.find((expense) => expense.expenseType === value) ?? null;

      return [value, getBaseFrequency(currentExpense, previousExpense)];
    }),
  ) as Record<HousingExpenseType, Frequency>;
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
      <p className="mt-3 max-w-full overflow-hidden whitespace-nowrap text-[clamp(1.5rem,2.4vw,2.25rem)] font-semibold leading-none tracking-[-0.06em]">
        {value}
      </p>
    </div>
  );
}

export function HousingView() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [housingExpenses, setHousingExpenses] = useState<HousingExpense[]>([]);
  const [previousHousingExpenses, setPreviousHousingExpenses] = useState<
    HousingExpense[]
  >([]);
  const [drafts, setDrafts] = useState<Record<HousingExpenseType, string>>(
    {} as Record<HousingExpenseType, string>,
  );
  const [frequencyDrafts, setFrequencyDrafts] = useState<
    Record<HousingExpenseType, Frequency>
  >({} as Record<HousingExpenseType, Frequency>);
  const [saveStates, setSaveStates] = useState<Record<HousingExpenseType, SaveState>>(
    {} as Record<HousingExpenseType, SaveState>,
  );
  const [messages, setMessages] = useState<Record<HousingExpenseType, string>>(
    {} as Record<HousingExpenseType, string>,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyingPreviousMonth, setCopyingPreviousMonth] = useState(false);

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

  useEffect(() => {
    let isCancelled = false;

    async function loadHousingData() {
      setLoading(true);
      setError(null);

      try {
        const [currentExpenses, previousExpenses] = await Promise.all([
          fetchHousingExpenses(selectedMonth),
          fetchHousingExpenses(previousMonth),
        ]);

        if (isCancelled) {
          return;
        }

        setHousingExpenses(currentExpenses);
        setPreviousHousingExpenses(previousExpenses);
        setDrafts(buildInitialDrafts(currentExpenses));
        setFrequencyDrafts(
          buildInitialFrequencyDrafts(currentExpenses, previousExpenses),
        );
        setSaveStates({} as Record<HousingExpenseType, SaveState>);
        setMessages({} as Record<HousingExpenseType, string>);
      } catch (loadError) {
        if (isCancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load housing expenses",
        );
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadHousingData();

    return () => {
      isCancelled = true;
    };
  }, [previousMonth, selectedMonth]);

  const housingRows = useMemo<HousingRow[]>(
    () =>
      housingExpenseTypeOptions.map(({ value, label }) => {
        const currentExpense =
          housingExpenses.find((expense) => expense.expenseType === value) ?? null;
        const previousExpense =
          previousHousingExpenses.find((expense) => expense.expenseType === value) ??
          null;
        const baseAmount = currentExpense ? formatInputAmount(currentExpense.amount) : "";
        const baseFrequency = getBaseFrequency(currentExpense, previousExpense);
        const draftAmount = drafts[value] ?? baseAmount;
        const draftFrequency = frequencyDrafts[value] ?? baseFrequency;
        const isDirty =
          getComparisonValue(draftAmount) !== getComparisonValue(baseAmount) ||
          draftFrequency !== baseFrequency;
        const isValidAmount = parsePositiveAmount(draftAmount) !== null;
        const saveState = saveStates[value] ?? "idle";
        const message = messages[value] ?? "";

        let statusText = currentExpense ? "Saved" : "No value saved";
        let statusTone: HousingRow["statusTone"] = currentExpense
          ? "success"
          : "default";

        if (saveState === "saving") {
          statusText = "Saving...";
          statusTone = "default";
        } else if (saveState === "error") {
          statusText = message || "Error";
          statusTone = "error";
        } else if (isDirty) {
          statusText = "Unsaved changes";
          statusTone = "default";
        }

        return {
          expenseType: value,
          label,
          hasStoredValue: currentExpense !== null,
          previousMonthAmount: previousExpense?.amount ?? null,
          previousMonthFrequency: previousExpense?.frequency ?? null,
          draftAmount,
          draftFrequency,
          monthlyEquivalent: calculateMonthlyEquivalent(draftAmount, draftFrequency),
          isDirty,
          isValidAmount,
          isSaving: saveState === "saving",
          statusText,
          statusTone,
          validationMessage:
            draftAmount.trim() && !isValidAmount
              ? "Enter an amount greater than 0"
              : null,
        };
      }),
    [
      drafts,
      frequencyDrafts,
      housingExpenses,
      messages,
      previousHousingExpenses,
      saveStates,
    ],
  );

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
  const housingMonthlyTotal = useMemo(
    () => housingRows.reduce((sum, row) => sum + row.monthlyEquivalent, 0),
    [housingRows],
  );
  const savedTypeCount = housingExpenses.length;
  const yearlyItemCount = housingExpenses.filter(
    (expense) => expense.frequency === "YEARLY",
  ).length;

  function updateDraft(expenseType: HousingExpenseType, amount: string) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [expenseType]: amount,
    }));
    setSaveStates((currentStates) => ({
      ...currentStates,
      [expenseType]: "idle",
    }));
    setMessages((currentMessages) => ({
      ...currentMessages,
      [expenseType]: "",
    }));
  }

  function updateFrequency(expenseType: HousingExpenseType, frequency: Frequency) {
    setFrequencyDrafts((currentDrafts) => ({
      ...currentDrafts,
      [expenseType]: frequency,
    }));
    setSaveStates((currentStates) => ({
      ...currentStates,
      [expenseType]: "idle",
    }));
    setMessages((currentMessages) => ({
      ...currentMessages,
      [expenseType]: "",
    }));
  }

  function resetRow(expenseType: HousingExpenseType) {
    const currentExpense =
      housingExpenses.find((expense) => expense.expenseType === expenseType) ?? null;
    const previousExpense =
      previousHousingExpenses.find((expense) => expense.expenseType === expenseType) ??
      null;

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [expenseType]: currentExpense ? formatInputAmount(currentExpense.amount) : "",
    }));
    setFrequencyDrafts((currentDrafts) => ({
      ...currentDrafts,
      [expenseType]: getBaseFrequency(currentExpense, previousExpense),
    }));
    setSaveStates((currentStates) => ({
      ...currentStates,
      [expenseType]: "idle",
    }));
    setMessages((currentMessages) => ({
      ...currentMessages,
      [expenseType]: "",
    }));
  }

  async function persistHousingExpense(
    expenseType: HousingExpenseType,
    amount: string,
    frequency: Frequency,
  ) {
    const normalizedAmount = formatInputAmount(amount);

    if (!normalizedAmount) {
      setSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "error",
      }));
      setMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]: "Enter an amount greater than 0",
      }));
      return;
    }

    setSaveStates((currentStates) => ({
      ...currentStates,
      [expenseType]: "saving",
    }));
    setMessages((currentMessages) => ({
      ...currentMessages,
      [expenseType]: "",
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
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: formatInputAmount(savedExpense.amount),
      }));
      setFrequencyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: savedExpense.frequency,
      }));
      setSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "saved",
      }));
    } catch (saveError) {
      setSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "error",
      }));
      setMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save housing expense",
      }));
    }
  }

  async function clearHousingExpense(expenseType: HousingExpenseType) {
    const existingExpense =
      housingExpenses.find((expense) => expense.expenseType === expenseType) ?? null;
    const previousExpense =
      previousHousingExpenses.find((expense) => expense.expenseType === expenseType) ??
      null;

    if (!existingExpense) {
      return;
    }

    setSaveStates((currentStates) => ({
      ...currentStates,
      [expenseType]: "saving",
    }));
    setMessages((currentMessages) => ({
      ...currentMessages,
      [expenseType]: "",
    }));

    try {
      const response = await fetch(`/api/housing/${existingExpense.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to clear housing expense"),
        );
      }

      setHousingExpenses((currentExpenses) =>
        currentExpenses.filter((expense) => expense.id !== existingExpense.id),
      );
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: "",
      }));
      setFrequencyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [expenseType]: getBaseFrequency(null, previousExpense),
      }));
      setSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "idle",
      }));
      setMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]: "",
      }));
    } catch (clearError) {
      setSaveStates((currentStates) => ({
        ...currentStates,
        [expenseType]: "error",
      }));
      setMessages((currentMessages) => ({
        ...currentMessages,
        [expenseType]:
          clearError instanceof Error
            ? clearError.message
            : "Failed to clear housing expense",
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
          persistHousingExpense(
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

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Housing
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  Housing costs
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                  Track rent, bills, and other home costs month by month. Each
                  expense type has its own card with explicit save, reset, and clear
                  actions.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label="Housing Monthly"
                  value={formatCurrency(housingMonthlyTotal)}
                  tone="dark"
                />
                <SummaryCard
                  label="Saved Types"
                  value={savedTypeCount.toString()}
                  tone="light"
                />
                <SummaryCard
                  label="Yearly Items"
                  value={yearlyItemCount.toString()}
                  tone="light"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
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
                    Review each expense type independently, compare against the
                    previous month, and save only the cards you want to update.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <MonthSelector
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  />
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
                        : `Copy missing from ${previousMonthLabel}`}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {loading ? (
                <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-12 text-center text-sm text-stone-500">
                  Loading housing expenses...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {housingRows.map((row) => (
                    <article
                      key={row.expenseType}
                      className="flex h-full flex-col rounded-[1.75rem] border border-stone-200 bg-white shadow-sm"
                    >
                      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-semibold tracking-tight text-stone-950">
                              {row.label}
                            </h3>
                            <p className="mt-2 text-sm text-stone-500">
                              {row.previousMonthAmount
                                ? `Previous month: ${formatCurrency(Number(row.previousMonthAmount))} / ${row.previousMonthFrequency?.toLowerCase()}`
                                : "No previous month value"}
                            </p>
                          </div>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">
                            {row.hasStoredValue ? "Saved" : "Empty"}
                          </span>
                        </div>

                        <div className="grid gap-4">
                          <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-stone-700">
                              Amount
                            </span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              value={row.draftAmount}
                              onChange={(event) =>
                                updateDraft(row.expenseType, event.target.value)
                              }
                              className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                            />
                          </label>

                          <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-stone-700">
                              Frequency
                            </span>
                            <select
                              value={row.draftFrequency}
                              onChange={(event) =>
                                updateFrequency(
                                  row.expenseType,
                                  event.target.value as Frequency,
                                )
                              }
                              className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                            >
                              {frequencyOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="rounded-2xl bg-stone-50 px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                            Monthly equivalent
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                            {formatCurrency(row.monthlyEquivalent)}
                          </p>
                          {row.validationMessage ? (
                            <p className="mt-2 text-sm text-red-600">
                              {row.validationMessage}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-auto flex flex-col gap-4">
                          <p
                            className={`text-sm ${
                              row.statusTone === "error"
                                ? "text-red-600"
                                : row.statusTone === "success"
                                  ? "text-emerald-600"
                                  : "text-stone-500"
                            }`}
                          >
                            {row.statusText}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void persistHousingExpense(
                                  row.expenseType,
                                  row.draftAmount,
                                  row.draftFrequency,
                                )
                              }
                              disabled={!row.isDirty || !row.isValidAmount || row.isSaving}
                              className="h-10 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                            >
                              {row.isSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => resetRow(row.expenseType)}
                              disabled={!row.isDirty || row.isSaving}
                              className="h-10 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                            >
                              Reset
                            </button>
                            {row.hasStoredValue ? (
                              <button
                                type="button"
                                onClick={() => void clearHousingExpense(row.expenseType)}
                                disabled={row.isSaving}
                                className="h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
