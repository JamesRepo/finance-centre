"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMonthLabel, getCurrentMonthValue } from "@/lib/months";
import { MonthSelector } from "../month-selector";

type BudgetCategory = {
  id: string;
  name: string;
  colorCode: string | null;
};

type BudgetEntry = {
  budgetId: string | null;
  categoryId: string;
  amount: string;
  spent: string;
  category: BudgetCategory;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatInputAmount(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "";
  }

  return amount.toFixed(2);
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function BudgetsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [saveMessages, setSaveMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const monthLabel = useMemo(
    () => formatMonthLabel(selectedMonth),
    [selectedMonth],
  );

  useEffect(() => {
    async function loadBudgets() {
      setLoading(true);
      setPageError(null);

      try {
        const response = await fetch(`/api/budgets?month=${selectedMonth}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, "Failed to load budgets"));
        }

        const data = (await response.json()) as BudgetEntry[];
        setEntries(data);
        setDrafts(
          Object.fromEntries(
            data.map((entry) => [entry.categoryId, formatInputAmount(entry.amount)]),
          ),
        );
        setSaveStates({});
        setSaveMessages({});
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Failed to load budgets");
      } finally {
        setLoading(false);
      }
    }

    void loadBudgets();
  }, [selectedMonth]);

  async function handleBlur(entry: BudgetEntry) {
    const currentValue = drafts[entry.categoryId] ?? "";
    const normalizedDraft = formatInputAmount(currentValue);
    const originalValue = formatInputAmount(entry.amount);

    if (normalizedDraft === originalValue) {
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [entry.categoryId]: originalValue,
      }));
      setSaveStates((currentStates) => ({
        ...currentStates,
        [entry.categoryId]: "idle",
      }));
      setSaveMessages((currentMessages) => ({
        ...currentMessages,
        [entry.categoryId]: "",
      }));
      return;
    }

    setSaveStates((currentStates) => ({
      ...currentStates,
      [entry.categoryId]: "saving",
    }));
    setSaveMessages((currentMessages) => ({
      ...currentMessages,
      [entry.categoryId]: "Saving...",
    }));

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          categoryId: entry.categoryId,
          month: selectedMonth,
          amount: normalizedDraft,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save budget"));
      }

      const savedEntry = (await response.json()) as {
        id: string;
        amount: string;
        createdAt: string;
      };
      const nextAmount = formatInputAmount(savedEntry.amount);

      setEntries((currentEntries) =>
        currentEntries.map((currentEntry) =>
          currentEntry.categoryId === entry.categoryId
            ? {
                ...currentEntry,
                budgetId: savedEntry.id,
                amount: savedEntry.amount,
              }
            : currentEntry,
        ),
      );
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [entry.categoryId]: nextAmount,
      }));
      setSaveStates((currentStates) => ({
        ...currentStates,
        [entry.categoryId]: "saved",
      }));
      setSaveMessages((currentMessages) => ({
        ...currentMessages,
        [entry.categoryId]: "Saved",
      }));
    } catch (error) {
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [entry.categoryId]: originalValue,
      }));
      setSaveStates((currentStates) => ({
        ...currentStates,
        [entry.categoryId]: "error",
      }));
      setSaveMessages((currentMessages) => ({
        ...currentMessages,
        [entry.categoryId]:
          error instanceof Error ? error.message : "Failed to save budget",
      }));
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Budgets
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  Budget setup
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  Set monthly targets by category. Changes save automatically when
                  you leave a field.
                </p>
              </div>

              <MonthSelector
                value={selectedMonth}
                onChange={setSelectedMonth}
                className="flex flex-col gap-3 lg:flex-row lg:items-end"
              />
            </div>
          </div>

          <div className="bg-stone-50 px-6 py-4">
            <p className="text-sm font-medium text-stone-600">{monthLabel}</p>
          </div>

          {pageError ? (
            <div className="px-6 py-8">
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {pageError}
              </p>
            </div>
          ) : null}

          {!pageError ? (
            <div>
              {loading ? (
                <div className="px-6 py-8 text-sm text-stone-500">
                  Loading budgets...
                </div>
              ) : (
                entries.map((entry) => {
                  const spentAmount = Number(entry.spent);
                  const saveState = saveStates[entry.categoryId] ?? "idle";
                  const saveMessage = saveMessages[entry.categoryId] ?? "";

                  return (
                    <div
                      key={entry.categoryId}
                      className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1.3fr)_180px_140px]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor: entry.category.colorCode ?? "#a8a29e",
                            }}
                          />
                          <h2 className="truncate text-base font-semibold text-stone-950">
                            {entry.category.name}
                          </h2>
                        </div>
                        <p className="mt-2 text-sm text-stone-500">
                          Spent this month: {currencyFormatter.format(spentAmount)}
                        </p>
                      </div>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Budget amount
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={drafts[entry.categoryId] ?? ""}
                          onChange={(event) =>
                            setDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [entry.categoryId]: event.target.value,
                            }))
                          }
                          onBlur={() => void handleBlur(entry)}
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                          placeholder="0.00"
                        />
                      </label>

                      <div className="flex items-center lg:justify-end">
                        <p
                          className={`text-sm font-medium ${
                            saveState === "error"
                              ? "text-red-600"
                              : saveState === "saved"
                                ? "text-green-600"
                                : "text-stone-500"
                          }`}
                        >
                          {saveMessage || " "}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
