"use client";

import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  formatMonthLabel,
  getCurrentMonthValue,
  shiftMonthValue,
} from "@/lib/months";
import { MonthSelector } from "../month-selector";

function getDefaultIncomeDate(month: string) {
  return `${month}-01`;
}

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const incomeTypeOptions = [
  { value: "SALARY", label: "Salary" },
  { value: "BONUS", label: "Bonus" },
  { value: "GIFT", label: "Gift" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "OTHER", label: "Other" },
] as const;

const recurrenceOptions = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "ANNUALLY", label: "Annually" },
  { value: "ONE_OFF", label: "One-Off" },
] as const;

const deductionTypeOptions = [
  { value: "INCOME_TAX", label: "Income Tax" },
  { value: "NI", label: "NI" },
  { value: "PENSION", label: "Pension" },
  { value: "STUDENT_LOAN", label: "Student Loan" },
  { value: "OTHER", label: "Other" },
] as const;

const deductionSchema = z.object({
  deductionType: z.enum(["INCOME_TAX", "NI", "PENSION", "STUDENT_LOAN", "OTHER"], {
    message: "Select a deduction type",
  }),
  name: z.string().trim().min(1, "Enter a deduction name"),
  amount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Amount must be greater than 0"),
  ),
});

const incomeFormSchema = z
  .object({
    incomeType: z.enum(["SALARY", "BONUS", "GIFT", "FREELANCE", "OTHER"], {
      message: "Select an income type",
    }),
    grossAmount: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().positive("Gross amount must be greater than 0"),
    ),
    netAmount: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().positive("Net amount must be greater than 0"),
    ),
    incomeDate: z.string().min(1, "Enter an income date"),
    isRecurring: z.boolean(),
    recurrenceFrequency: z
      .enum(["MONTHLY", "WEEKLY", "ANNUALLY", "ONE_OFF"])
      .optional(),
    deductions: z.array(deductionSchema),
  })
  .superRefine((value, context) => {
    if (value.isRecurring && !value.recurrenceFrequency) {
      context.addIssue({
        code: "custom",
        path: ["recurrenceFrequency"],
        message: "Select a frequency",
      });
    }
  });

type IncomeType = (typeof incomeTypeOptions)[number]["value"];
type RecurrenceFrequency = (typeof recurrenceOptions)[number]["value"];
type DeductionType = (typeof deductionTypeOptions)[number]["value"];
type IncomeFormValues = z.input<typeof incomeFormSchema>;
type IncomeFormSubmitValues = z.output<typeof incomeFormSchema>;

type IncomeDeduction = {
  id: number;
  deductionType: DeductionType;
  name: string;
  amount: string;
  isPercentage: boolean;
  percentageValue: string | null;
  isActive: boolean;
  createdAt: string;
};

type IncomeEntry = {
  id: number;
  incomeType: IncomeType;
  description: string | null;
  grossAmount: string;
  netAmount: string;
  incomeDate: string;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  isActive: boolean;
  createdAt: string;
  totalDeductions: string;
  incomeDeductions: IncomeDeduction[];
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function parseAmount(value: string) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function buildDateTime(date: string) {
  return `${date}T00:00:00.000Z`;
}

function formatDisplayDate(date: string) {
  const datePart = date.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);

  return format(new Date(year, month - 1, day), "dd MMM yyyy");
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function createEmptyDeduction() {
  return {
    deductionType: "INCOME_TAX" as DeductionType,
    name: "",
    amount: undefined,
  };
}

export default function IncomePage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [copyingIncome, setCopyingIncome] = useState(false);
  const [previousMonthIncomeCount, setPreviousMonthIncomeCount] = useState(0);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncomeFormValues, undefined, IncomeFormSubmitValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: {
      incomeType: "SALARY",
      grossAmount: undefined,
      netAmount: undefined,
      incomeDate: getDefaultIncomeDate(getCurrentMonthValue()),
      isRecurring: false,
      recurrenceFrequency: undefined,
      deductions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "deductions",
  });

  const watchedGrossAmount = useWatch({ control, name: "grossAmount" });
  const watchedNetAmount = useWatch({ control, name: "netAmount" });
  const watchedIsRecurring = useWatch({ control, name: "isRecurring" });
  const watchedDeductions = useWatch({ control, name: "deductions" });

  const totalDeductions = useMemo(
    () =>
      (watchedDeductions ?? []).reduce((sum, deduction) => {
        const amount = Number(deduction?.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [watchedDeductions],
  );

  const calculatedNet = (Number(watchedGrossAmount) || 0) - totalDeductions;
  const enteredNet = Number(watchedNetAmount) || 0;
  const hasNetMismatch =
    watchedNetAmount !== undefined && Math.abs(calculatedNet - enteredNet) > 0.009;

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
  const incomeTotal = useMemo(
    () => incomeEntries.reduce((sum, entry) => sum + parseAmount(entry.netAmount), 0),
    [incomeEntries],
  );
  const grossIncomeTotal = useMemo(
    () => incomeEntries.reduce((sum, entry) => sum + parseAmount(entry.grossAmount), 0),
    [incomeEntries],
  );
  const deductionsTotal = useMemo(
    () =>
      incomeEntries.reduce((sum, entry) => sum + parseAmount(entry.totalDeductions), 0),
    [incomeEntries],
  );

  const fetchIncomeEntries = useCallback(async (month: string) => {
    const response = await fetch(`/api/income?month=${month}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to load income"));
    }

    return (await response.json()) as IncomeEntry[];
  }, []);

  const loadIncomeEntries = useCallback(
    async (month: string) => {
      setIncomeLoading(true);
      setIncomeError(null);

      try {
        const [currentEntries, previousEntries] = await Promise.all([
          fetchIncomeEntries(month),
          fetchIncomeEntries(shiftMonthValue(month, -1)),
        ]);

        setIncomeEntries(currentEntries);
        setPreviousMonthIncomeCount(previousEntries.length);
        setExpandedIds((currentExpandedIds) =>
          currentExpandedIds.filter((id) =>
            currentEntries.some((entry) => entry.id === id),
          ),
        );
      } catch (error) {
        setIncomeError(error instanceof Error ? error.message : "Failed to load income");
      } finally {
        setIncomeLoading(false);
      }
    },
    [fetchIncomeEntries],
  );

  useEffect(() => {
    void loadIncomeEntries(selectedMonth);
  }, [loadIncomeEntries, selectedMonth]);

  useEffect(() => {
    if (editingId !== null) {
      return;
    }

    reset({
      incomeType: "SALARY",
      grossAmount: undefined,
      netAmount: undefined,
      incomeDate: getDefaultIncomeDate(selectedMonth),
      isRecurring: false,
      recurrenceFrequency: undefined,
      deductions: [],
    });
  }, [editingId, reset, selectedMonth]);

  function resetForm() {
    reset({
      incomeType: "SALARY",
      grossAmount: undefined,
      netAmount: undefined,
      incomeDate: getDefaultIncomeDate(selectedMonth),
      isRecurring: false,
      recurrenceFrequency: undefined,
      deductions: [],
    });
    setEditingId(null);
    setSubmitError(null);
  }

  async function onSubmit(values: IncomeFormSubmitValues) {
    setSubmitError(null);

    if (!values.incomeDate.startsWith(selectedMonth)) {
      setSubmitError("Income date must be within the selected month");
      return;
    }

    const payload = {
      incomeType: values.incomeType,
      grossAmount: values.grossAmount,
      netAmount: values.netAmount,
      incomeDate: buildDateTime(values.incomeDate),
      isRecurring: values.isRecurring,
      recurrenceFrequency: values.isRecurring
        ? values.recurrenceFrequency
        : editingId
          ? null
          : undefined,
      deductions: values.deductions.map((deduction) => ({
        deductionType: deduction.deductionType,
        name: deduction.name.trim(),
        amount: deduction.amount,
      })),
    };

    try {
      const response = await fetch(
        editingId ? `/api/income/${editingId}` : "/api/income",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            editingId ? "Failed to update income entry" : "Failed to create income entry",
          ),
        );
      }

      resetForm();
      await loadIncomeEntries(selectedMonth);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : editingId
            ? "Failed to update income entry"
            : "Failed to create income entry",
      );
    }
  }

  function handleEdit(entry: IncomeEntry) {
    reset({
      incomeType: entry.incomeType,
      grossAmount: parseAmount(entry.grossAmount),
      netAmount: parseAmount(entry.netAmount),
      incomeDate: entry.incomeDate.slice(0, 10),
      isRecurring: entry.isRecurring,
      recurrenceFrequency: entry.recurrenceFrequency ?? undefined,
      deductions:
        entry.incomeDeductions.length > 0
          ? entry.incomeDeductions.map((deduction) => ({
              deductionType: deduction.deductionType,
              name: deduction.name,
              amount: parseAmount(deduction.amount),
            }))
          : [],
    });
    setEditingId(entry.id);
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(entryId: number) {
    setDeleteId(entryId);
    setIncomeError(null);

    try {
      const response = await fetch(`/api/income/${entryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete income entry"));
      }

      if (editingId === entryId) {
        resetForm();
      }

      await loadIncomeEntries(selectedMonth);
    } catch (error) {
      setIncomeError(
        error instanceof Error ? error.message : "Failed to delete income entry",
      );
    } finally {
      setDeleteId(null);
    }
  }

  function toggleExpanded(entryId: number) {
    setExpandedIds((currentExpandedIds) =>
      currentExpandedIds.includes(entryId)
        ? currentExpandedIds.filter((id) => id !== entryId)
        : [...currentExpandedIds, entryId],
    );
  }

  function handleSelectedMonthChange(month: string) {
    setSelectedMonth(month);
    setEditingId(null);
    setSubmitError(null);
  }

  async function handleCopyIncome(sourceMonth: string, targetMonth: string) {
    setIncomeError(null);
    setCopyingIncome(true);

    try {
      const [sourceEntries, targetEntries] = await Promise.all([
        sourceMonth === selectedMonth
          ? Promise.resolve(incomeEntries)
          : fetchIncomeEntries(sourceMonth),
        targetMonth === selectedMonth
          ? Promise.resolve(incomeEntries)
          : fetchIncomeEntries(targetMonth),
      ]);

      if (sourceEntries.length === 0) {
        return;
      }

      const targetKeys = new Set(
        targetEntries.map((entry) =>
          [
            entry.incomeType,
            entry.description ?? "",
            entry.grossAmount,
            entry.netAmount,
            Number(entry.incomeDate.slice(8, 10)),
          ].join("\u001f"),
        ),
      );
      const skippedCount = sourceEntries.filter((entry) => {
        const [year, monthNumber] = targetMonth.split("-").map(Number);
        const lastDayOfMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
        const dayOfMonth = Math.min(
          Number(entry.incomeDate.slice(8, 10)),
          lastDayOfMonth,
        );

        return targetKeys.has(
          [
            entry.incomeType,
            entry.description ?? "",
            entry.grossAmount,
            entry.netAmount,
            dayOfMonth,
          ].join("\u001f"),
        );
      }).length;
      const copiedCount = sourceEntries.length - skippedCount;

      const confirmed = window.confirm(
        `Copy ${copiedCount} income entr${copiedCount === 1 ? "y" : "ies"} from ${formatMonthLabel(sourceMonth)} to ${formatMonthLabel(targetMonth)}? ${skippedCount} already ${skippedCount === 1 ? "exists" : "exist"} and will be skipped.`,
      );

      if (!confirmed) {
        return;
      }

      const response = await fetch("/api/income/copy", {
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
        throw new Error(await readApiError(response, "Failed to copy income"));
      }

      if (targetMonth === shiftMonthValue(selectedMonth, 1)) {
        handleSelectedMonthChange(targetMonth);
      } else {
        await loadIncomeEntries(selectedMonth);
      }
    } catch (error) {
      setIncomeError(error instanceof Error ? error.message : "Failed to copy income");
    } finally {
      setCopyingIncome(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              Income
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
                  {editingId ? "Edit income entry" : "Log a new income entry"}
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  Track gross pay, deductions, and take-home income in one place.
                </p>
              </div>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-stone-300 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>

          <form className="px-6 py-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="flex flex-col gap-2 xl:col-span-2">
                <span className="text-sm font-medium text-stone-700">Income type</span>
                <select
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                  disabled={isSubmitting}
                  {...register("incomeType")}
                >
                  {incomeTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.incomeType ? (
                  <p className="text-sm text-red-600">{errors.incomeType.message}</p>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Gross amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                  disabled={isSubmitting}
                  placeholder="0.00"
                  {...register("grossAmount")}
                />
                {errors.grossAmount ? (
                  <p className="text-sm text-red-600">{errors.grossAmount.message}</p>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Net amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                  disabled={isSubmitting}
                  placeholder="0.00"
                  {...register("netAmount")}
                />
                {errors.netAmount ? (
                  <p className="text-sm text-red-600">{errors.netAmount.message}</p>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Income date</span>
                <input
                  type="date"
                  autoComplete="off"
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                  disabled={isSubmitting}
                  {...register("incomeDate")}
                />
                {errors.incomeDate ? (
                  <p className="text-sm text-red-600">{errors.incomeDate.message}</p>
                ) : null}
              </label>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-950">
                      Deductions
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">
                      Add tax, pension, or other deductions inline.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-3 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-950"
                      disabled={isSubmitting}
                      {...register("isRecurring")}
                    />
                    Recurring income
                  </label>
                </div>

                {watchedIsRecurring ? (
                  <label className="mt-4 flex max-w-xs flex-col gap-2">
                    <span className="text-sm font-medium text-stone-700">Frequency</span>
                    <select
                      className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                      disabled={isSubmitting}
                      {...register("recurrenceFrequency")}
                    >
                      <option value="">Select a frequency</option>
                      {recurrenceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.recurrenceFrequency ? (
                      <p className="text-sm text-red-600">
                        {errors.recurrenceFrequency.message}
                      </p>
                    ) : null}
                  </label>
                ) : null}

                <div className="mt-5 flex flex-col gap-4">
                  {fields.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-sm text-stone-500">
                      No deductions added. Use the button below if you want to record tax,
                      pension, or other deductions.
                    </div>
                  ) : (
                    fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-[11rem_minmax(0,1fr)_9rem_auto]"
                      >
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                            Type
                          </span>
                          <select
                            className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                            disabled={isSubmitting}
                            {...register(`deductions.${index}.deductionType`)}
                          >
                            {deductionTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {errors.deductions?.[index]?.deductionType ? (
                            <p className="text-sm text-red-600">
                              {errors.deductions[index]?.deductionType?.message}
                            </p>
                          ) : null}
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                            Name
                          </span>
                          <input
                            type="text"
                            className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                            disabled={isSubmitting}
                            placeholder="Enter name"
                            {...register(`deductions.${index}.name`)}
                          />
                          {errors.deductions?.[index]?.name ? (
                            <p className="text-sm text-red-600">
                              {errors.deductions[index]?.name?.message}
                            </p>
                          ) : null}
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                            Amount
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                            disabled={isSubmitting}
                            placeholder="0.00"
                            {...register(`deductions.${index}.amount`)}
                          />
                          {errors.deductions?.[index]?.amount ? (
                            <p className="text-sm text-red-600">
                              {errors.deductions[index]?.amount?.message}
                            </p>
                          ) : null}
                        </label>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-300 px-3 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={() => append(createEmptyDeduction())}
                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950 sm:w-auto"
                  >
                    Add deduction
                  </button>
                </div>
              </div>

              <aside className="rounded-[1.75rem] bg-stone-950 p-5 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Live summary
                </p>
                <dl className="mt-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-stone-300">Gross</dt>
                    <dd className="text-lg font-semibold">
                      {formatCurrency(Number(watchedGrossAmount) || 0)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-stone-300">Total deductions</dt>
                    <dd className="text-lg font-semibold">
                      {formatCurrency(totalDeductions)}
                    </dd>
                  </div>
                  <div className="border-t border-stone-800 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-stone-300">Calculated net</dt>
                      <dd className="text-2xl font-semibold">
                        {formatCurrency(calculatedNet)}
                      </dd>
                    </div>
                  </div>
                </dl>

                <div
                  className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
                    hasNetMismatch
                      ? "bg-red-500/15 text-red-100 ring-1 ring-red-400/30"
                      : "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/30"
                  }`}
                >
                  {hasNetMismatch
                    ? `Entered net does not match by ${formatCurrency(
                        Math.abs(calculatedNet - enteredNet),
                      )}.`
                    : "Entered net matches the deduction summary."}
                </div>

                {submitError ? (
                  <p className="mt-4 text-sm text-red-300">{submitError}</p>
                ) : null}

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-stone-950 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? editingId
                        ? "Saving..."
                        : "Adding..."
                      : editingId
                        ? "Save changes"
                        : "Log income"}
                  </button>
                  {editingId ? (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-stone-700 px-5 text-sm font-medium text-stone-200 transition hover:border-stone-500 hover:text-white"
                    >
                      Discard changes
                    </button>
                  ) : null}
                </div>
              </aside>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
                  {monthLabel}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Manage income month by month and copy entries forward when pay stays
                  the same.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <MonthSelector
                  value={selectedMonth}
                  onChange={handleSelectedMonthChange}
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                />
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyIncome(
                      selectedMonth,
                      shiftMonthValue(selectedMonth, 1),
                    )
                  }
                  disabled={copyingIncome || incomeEntries.length === 0}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                >
                  {copyingIncome ? "Copying..." : "Copy to Next Month"}
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.75rem] bg-stone-950 px-5 py-5 text-white">
                <p className="text-sm font-medium text-stone-300">Net Income</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {formatCurrency(incomeTotal)}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-medium text-stone-500">Gross Income</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {formatCurrency(grossIncomeTotal)}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-medium text-stone-500">Deductions</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {formatCurrency(deductionsTotal)}
                </p>
              </div>
            </div>

            {incomeError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {incomeError}
              </div>
            ) : null}

            {incomeLoading ? (
              <p className="text-sm text-stone-500">Loading income entries...</p>
            ) : incomeEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
                <h3 className="text-xl font-semibold tracking-tight text-stone-950">
                  No income entries in {monthLabel}
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-500">
                  Add an income entry with the form, or copy from {previousMonthLabel}
                  if you want to reuse last month&apos;s pay.
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void handleCopyIncome(previousMonth, selectedMonth)}
                    disabled={copyingIncome || previousMonthIncomeCount === 0}
                    className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                  >
                    {copyingIncome
                      ? "Copying..."
                      : previousMonthIncomeCount === 0
                        ? `Nothing to copy from ${previousMonthLabel}`
                        : `Copy from ${previousMonthLabel}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-stone-200">
                {incomeEntries.map((entry, index) => {
                        const isExpanded = expandedIds.includes(entry.id);

                        return (
                          <div
                            key={entry.id}
                            className={index === 0 ? "" : "border-t border-stone-200"}
                          >
                            <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(entry.id)}
                                className="flex flex-1 flex-col gap-4 text-left sm:flex-row sm:items-center"
                              >
                                <span className="inline-flex w-fit items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-700">
                                  {
                                    incomeTypeOptions.find(
                                      (option) => option.value === entry.incomeType,
                                    )?.label
                                  }
                                </span>
                                <span className="text-sm text-stone-500">
                                  {formatDisplayDate(entry.incomeDate)}
                                </span>
                                <span className="text-sm font-medium text-stone-700">
                                  Gross {formatCurrency(parseAmount(entry.grossAmount))}
                                </span>
                                <span className="text-sm font-medium text-stone-700">
                                  Net {formatCurrency(parseAmount(entry.netAmount))}
                                </span>
                                <span className="text-sm text-stone-500">
                                  {entry.incomeDeductions.length}{" "}
                                  {entry.incomeDeductions.length === 1
                                    ? "deduction"
                                    : "deductions"}
                                </span>
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(entry)}
                                  className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-300 px-3 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(entry.id)}
                                  disabled={deleteId === entry.id}
                                  className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 px-3 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {deleteId === entry.id ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>

                            {isExpanded ? (
                              <div className="border-t border-stone-200 bg-stone-50 px-4 py-4">
                                <div className="grid gap-4 md:grid-cols-3">
                                  <div className="rounded-2xl bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                                      Summary
                                    </p>
                                    <dl className="mt-3 space-y-2 text-sm text-stone-700">
                                      <div className="flex items-center justify-between gap-4">
                                        <dt>Gross</dt>
                                        <dd>{formatCurrency(parseAmount(entry.grossAmount))}</dd>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <dt>Total deductions</dt>
                                        <dd>
                                          {formatCurrency(parseAmount(entry.totalDeductions))}
                                        </dd>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <dt>Net</dt>
                                        <dd>{formatCurrency(parseAmount(entry.netAmount))}</dd>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <dt>Recurring</dt>
                                        <dd>
                                          {entry.isRecurring
                                            ? recurrenceOptions.find(
                                                (option) =>
                                                  option.value === entry.recurrenceFrequency,
                                              )?.label ?? "Yes"
                                            : "No"}
                                        </dd>
                                      </div>
                                    </dl>
                                  </div>

                                  <div className="rounded-2xl bg-white p-4 md:col-span-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                                      Deduction breakdown
                                    </p>
                                    {entry.incomeDeductions.length === 0 ? (
                                      <p className="mt-3 text-sm text-stone-500">
                                        No deductions recorded for this entry.
                                      </p>
                                    ) : (
                                      <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200">
                                        {entry.incomeDeductions.map((deduction, deductionIndex) => (
                                          <div
                                            key={deduction.id}
                                            className={
                                              deductionIndex === 0
                                                ? "grid gap-2 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_8rem]"
                                                : "grid gap-2 border-t border-stone-200 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_8rem]"
                                            }
                                          >
                                            <span className="text-sm font-medium text-stone-700">
                                              {
                                                deductionTypeOptions.find(
                                                  (option) =>
                                                    option.value === deduction.deductionType,
                                                )?.label
                                              }
                                            </span>
                                            <span className="text-sm text-stone-500">
                                              {deduction.name}
                                            </span>
                                            <span className="text-sm font-medium text-stone-950 sm:text-right">
                                              {formatCurrency(parseAmount(deduction.amount))}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
