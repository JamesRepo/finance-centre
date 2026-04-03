"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  createTransactionRequest,
  fetchVendorSuggestions,
  formatTransactionDisplayDate,
  readApiError,
  updateTransactionRequest,
} from "./transaction-page-helpers";

const today = new Date();
const defaultDate = format(today, "yyyy-MM-dd");
const defaultMonth = format(today, "yyyy-MM");

const amountFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const transactionFormSchema = z.object({
  categoryId: z.string().trim().min(1, "Select a category"),
  lineItems: z
    .array(
      z.object({
        amount: z.preprocess(
          (value) => (value === "" ? undefined : value),
          z.coerce.number().positive("Amount must be positive"),
        ),
      }),
    )
    .min(1, "Add at least one amount"),
  transactionDate: z.string().min(1, "Enter a date"),
  description: z.string().trim().optional(),
  vendor: z.string().trim().optional(),
});

type TransactionFormValues = z.input<typeof transactionFormSchema>;
type TransactionFormSubmitValues = z.output<typeof transactionFormSchema>;

type Category = {
  id: string;
  name: string;
  colorCode: string | null;
};

type Transaction = {
  id: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  description: string | null;
  vendor: string | null;
  lineItems: Array<{
    id: string;
    amount: string;
    sortOrder: number;
  }>;
  category: Category;
};

function createEmptyLineItem() {
  return {
    amount: "",
  };
}

function getLineItemsErrorMessage(
  error:
    | {
        message?: string;
        root?: { message?: string };
        [index: number]: { amount?: { message?: string } } | undefined;
      }
    | undefined,
) {
  if (!error) {
    return null;
  }

  if (error.message) {
    return error.message;
  }

  if (error.root?.message) {
    return error.root.message;
  }

  for (const value of Object.values(error)) {
    if (value && typeof value === "object" && "amount" in value) {
      const lineItem = value as { amount?: { message?: string } };
      if (lineItem.amount?.message) {
        return lineItem.amount.message;
      }
    }
  }

  return null;
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function parseQuickDateInput(
  value: string,
  fallbackDate: Date = new Date(),
): Date | null {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === "t" || normalizedValue === "today") {
    return new Date();
  }

  if (normalizedValue === "y" || normalizedValue === "yesterday") {
    return addDays(new Date(), -1);
  }

  if (/^[+-]\d+$/.test(normalizedValue)) {
    return addDays(fallbackDate, Number(normalizedValue));
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    const parsed = parseISO(normalizedValue);
    return isValid(parsed) ? parsed : null;
  }

  const shortDateMatch = normalizedValue.match(
    /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?$/,
  );

  if (!shortDateMatch) {
    return null;
  }

  const day = Number(shortDateMatch[1]);
  const month = Number(shortDateMatch[2]);
  const yearToken = shortDateMatch[3];
  const year = yearToken
    ? yearToken.length === 2
      ? 2000 + Number(yearToken)
      : Number(yearToken)
    : fallbackDate.getFullYear();
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function normalizeTransactionDateInput(
  value: string,
  fallbackDate: Date = new Date(),
): string | null {
  const parsed = parseQuickDateInput(value, fallbackDate);
  return parsed ? format(parsed, "yyyy-MM-dd") : null;
}

function parseAbsoluteTransactionDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export default function TransactionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [vendorSuggestionsLoading, setVendorSuggestionsLoading] = useState(false);
  const [vendorSuggestionsOpen, setVendorSuggestionsOpen] = useState(false);
  const [highlightedVendorIndex, setHighlightedVendorIndex] = useState(-1);
  const [shouldRestoreCategoryFocus, setShouldRestoreCategoryFocus] = useState(false);
  const hasAppliedInitialFormFocus = useRef(false);
  const categoryFieldRef = useRef<HTMLSelectElement | null>(null);
  const vendorInputRef = useRef<HTMLInputElement | null>(null);
  const vendorLookupRequestIdRef = useRef(0);
  const lastResolvedTransactionDateRef = useRef(parseISO(defaultDate));
  const vendorSuggestionsListId = useId();

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    setError,
    setValue,
    getValues,
    watch,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues, undefined, TransactionFormSubmitValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      categoryId: "",
      lineItems: [createEmptyLineItem()],
      transactionDate: defaultDate,
      description: "",
      vendor: "",
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: editControl,
    getValues: getEditValues,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<TransactionFormValues, undefined, TransactionFormSubmitValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      lineItems: [createEmptyLineItem()],
    },
  });

  const {
    fields: addLineItemFields,
    append: appendLineItem,
    remove: removeLineItem,
  } = useFieldArray({
    control,
    name: "lineItems",
  });

  const {
    fields: editLineItemFields,
    append: appendEditLineItem,
    remove: removeEditLineItem,
  } = useFieldArray({
    control: editControl,
    name: "lineItems",
  });

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);

    try {
      const response = await fetch("/api/categories", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load categories"));
      }

      const data = (await response.json()) as Category[];
      setCategories(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load categories";
      setCategoriesError(message);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (month: string) => {
    setTransactionsLoading(true);
    setTransactionsError(null);

    try {
      const response = await fetch(`/api/transactions?month=${month}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load transactions"));
      }

      const data = (await response.json()) as Transaction[];
      setTransactions(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load transactions";
      setTransactionsError(message);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadTransactions(selectedMonth);
  }, [loadTransactions, selectedMonth]);

  useEffect(() => {
    if (
      hasAppliedInitialFormFocus.current ||
      categoriesLoading ||
      categories.length === 0
    ) {
      return;
    }

    setFocus("categoryId");
    hasAppliedInitialFormFocus.current = true;
  }, [categories, categoriesLoading, setFocus]);

  useEffect(() => {
    if (
      !shouldRestoreCategoryFocus ||
      categoriesLoading ||
      !categoryFieldRef.current
    ) {
      return;
    }

    categoryFieldRef.current.focus();
    setFocus("categoryId");
    setShouldRestoreCategoryFocus(false);
  }, [categoriesLoading, setFocus, shouldRestoreCategoryFocus]);

  const vendorValue = watch("vendor") ?? "";

  useEffect(() => {
    if (!vendorSuggestionsOpen) {
      return;
    }

    const requestId = ++vendorLookupRequestIdRef.current;

    setVendorSuggestionsLoading(true);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const result = await fetchVendorSuggestions(vendorValue);

        if (requestId !== vendorLookupRequestIdRef.current) {
          return;
        }

        if (!result.ok) {
          setVendorSuggestions([]);
          setHighlightedVendorIndex(-1);
          setVendorSuggestionsLoading(false);
          return;
        }

        setVendorSuggestions(result.vendors);
        setHighlightedVendorIndex((currentIndex) => {
          if (result.vendors.length === 0) {
            return -1;
          }

          return Math.min(currentIndex, result.vendors.length - 1);
        });
        setVendorSuggestionsLoading(false);
      })();
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [vendorSuggestionsOpen, vendorValue]);

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);

    return format(new Date(year, month - 1, 1), "MMMM yyyy");
  }, [selectedMonth]);

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (filterCategoryId) {
      result = result.filter((t) => t.categoryId === filterCategoryId);
    }

    if (filterDateFrom) {
      result = result.filter((t) => t.transactionDate.slice(0, 10) >= filterDateFrom);
    }

    if (filterDateTo) {
      result = result.filter((t) => t.transactionDate.slice(0, 10) <= filterDateTo);
    }

    return [...result].sort((a, b) => {
      const dateA = a.transactionDate.slice(0, 10);
      const dateB = b.transactionDate.slice(0, 10);
      return sortDirection === "asc"
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });
  }, [transactions, filterCategoryId, filterDateFrom, filterDateTo, sortDirection]);

  function setTransactionDateValue(value: string) {
    const parsed = parseISO(value);

    if (isValid(parsed)) {
      lastResolvedTransactionDateRef.current = parsed;
    }

    setValue("transactionDate", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function getBaseTransactionDate() {
    const currentValue = getValues("transactionDate") || "";
    const currentAbsoluteDate = parseAbsoluteTransactionDate(currentValue);

    if (currentAbsoluteDate) {
      return currentAbsoluteDate;
    }

    return lastResolvedTransactionDateRef.current;
  }

  function shiftTransactionDate(days: number) {
    setTransactionDateValue(
      format(addDays(getBaseTransactionDate(), days), "yyyy-MM-dd"),
    );
    clearErrors("transactionDate");
  }

  function normalizeAddFormDateInput(value: string) {
    const normalizedValue = normalizeTransactionDateInput(value, getBaseTransactionDate());

    if (!normalizedValue) {
      return null;
    }

    setTransactionDateValue(normalizedValue);
    clearErrors("transactionDate");
    return normalizedValue;
  }

  async function onSubmit(values: TransactionFormSubmitValues) {
    setSubmitError(null);
    const normalizedDate = normalizeTransactionDateInput(
      values.transactionDate,
      getBaseTransactionDate(),
    );

    if (!normalizedDate) {
      setError("transactionDate", {
        type: "validate",
        message: "Enter a valid date",
      });
      setFocus("transactionDate");
      return;
    }

    if (normalizedDate !== values.transactionDate) {
      setTransactionDateValue(normalizedDate);
    }

    const result = await createTransactionRequest({
      categoryId: values.categoryId,
      lineItems: values.lineItems.map((lineItem) => ({
        amount: lineItem.amount,
      })),
      transactionDate: normalizedDate,
      description: values.description?.trim() || undefined,
      vendor: values.vendor?.trim() || undefined,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    reset({
      categoryId: "",
      lineItems: [createEmptyLineItem()],
      transactionDate: normalizedDate,
      description: "",
      vendor: "",
    });
    setVendorSuggestions([]);
    setVendorSuggestionsOpen(false);
    setHighlightedVendorIndex(-1);
    setShouldRestoreCategoryFocus(true);

    const submittedMonth = result.submittedMonth;

    if (submittedMonth !== selectedMonth) {
      setSelectedMonth(submittedMonth);
      return;
    }

    await loadTransactions(selectedMonth);
  }

  async function handleDelete(transactionId: string) {
    setDeleteId(transactionId);
    setTransactionsError(null);

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete transaction"));
      }

      await loadTransactions(selectedMonth);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete transaction";
      setTransactionsError(message);
    } finally {
      setDeleteId(null);
    }
  }

  function handleStartEdit(transaction: Transaction) {
    setEditingId(transaction.id);
    setEditError(null);
    resetEdit({
      categoryId: transaction.categoryId,
      lineItems:
        transaction.lineItems.length > 0
          ? transaction.lineItems.map((lineItem) => ({
              amount: Number(lineItem.amount),
            }))
          : [{ amount: Number(transaction.amount) }],
      transactionDate: transaction.transactionDate.slice(0, 10),
      description: transaction.description ?? "",
      vendor: transaction.vendor ?? "",
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function onEditSubmit(values: TransactionFormSubmitValues) {
    if (!editingId) return;
    setEditError(null);

    const result = await updateTransactionRequest(editingId, {
      categoryId: values.categoryId,
      lineItems: values.lineItems.map((lineItem) => ({
        amount: lineItem.amount,
      })),
      transactionDate: values.transactionDate,
      description: values.description?.trim() || undefined,
      vendor: values.vendor?.trim() || undefined,
    });

    if (!result.ok) {
      setEditError(result.error);
      return;
    }

    setEditingId(null);

    const submittedMonth = result.submittedMonth;

    if (submittedMonth !== selectedMonth) {
      setSelectedMonth(submittedMonth);
      return;
    }

    await loadTransactions(selectedMonth);
  }

  function selectVendorSuggestion(vendor: string) {
    setValue("vendor", vendor, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setVendorSuggestionsOpen(false);
    setHighlightedVendorIndex(-1);
    vendorInputRef.current?.focus();
  }

  const categoryField = register("categoryId");
  const transactionDateField = register("transactionDate");
  const vendorField = register("vendor");
  const shouldShowVendorSuggestions =
    vendorSuggestionsOpen && (vendorSuggestionsLoading || vendorSuggestions.length > 0);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Transactions
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                  Add a transaction
                </h1>
              </div>
              <Link
                href="/transactions/summary"
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                View Summary
              </Link>
            </div>
          </div>

          <form
            className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-5"
            onSubmit={handleSubmit(onSubmit)}
            data-form-type="other"
            autoComplete="off"
          >
            <label className="flex flex-col gap-2 xl:col-span-2">
              <span className="text-sm font-medium text-stone-700">Category</span>
              <select
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={categoriesLoading || isSubmitting}
                {...categoryField}
                ref={(element) => {
                  categoryField.ref(element);
                  categoryFieldRef.current = element;
                }}
              >
                <option value="">
                  {categoriesLoading ? "Loading categories..." : "Select a category"}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId ? (
                <p className="text-sm text-red-600">{errors.categoryId.message}</p>
              ) : null}
              {categoriesError ? (
                <p className="text-sm text-red-600">{categoriesError}</p>
              ) : null}
            </label>

            <div className="flex flex-col gap-2 xl:col-span-2">
              <span className="text-sm font-medium text-stone-700">Amounts</span>
              <div className="space-y-2">
                {addLineItemFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      className="h-11 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                      disabled={isSubmitting}
                      placeholder="0.00"
                      aria-label={`Amount ${index + 1}`}
                      {...register(`lineItems.${index}.amount`)}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => {
                        if (addLineItemFields.length === 1) {
                          setValue("lineItems.0.amount", "", {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                          return;
                        }

                        removeLineItem(index);
                      }}
                      disabled={isSubmitting}
                      className="h-11 rounded-xl border border-stone-300 px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-start">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => appendLineItem(createEmptyLineItem())}
                  disabled={isSubmitting}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                >
                  Add amount
                </button>
              </div>
              {errors.lineItems ? (
                <p className="text-sm text-red-600">
                  {getLineItemsErrorMessage(errors.lineItems)}
                </p>
              ) : null}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Date</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                autoComplete="off"
                data-form-type="other"
                placeholder="t, y, +1, 31/3"
                onKeyDown={(event) => {
                  if (event.altKey || event.ctrlKey || event.metaKey) {
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    shiftTransactionDate(event.shiftKey ? 7 : 1);
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    shiftTransactionDate(event.shiftKey ? -7 : -1);
                  }
                }}
                onBlur={(event) => {
                  transactionDateField.onBlur(event);

                  if (!event.target.value.trim()) {
                    return;
                  }

                  normalizeAddFormDateInput(event.target.value);
                }}
                name={transactionDateField.name}
                ref={transactionDateField.ref}
                onChange={transactionDateField.onChange}
              />
              <p className="text-xs text-stone-500">
                Type `t`, `y`, `+1`, or `31/3`. Arrow Up and Arrow Down move one day,
                Shift moves a week.
              </p>
              {errors.transactionDate ? (
                <p className="text-sm text-red-600">{errors.transactionDate.message}</p>
              ) : null}
            </label>

            <label className="relative flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Vendor</span>
              <input
                type="text"
                role="combobox"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={vendorSuggestionsListId}
                aria-expanded={shouldShowVendorSuggestions}
                aria-haspopup="listbox"
                onFocus={() => {
                  setVendorSuggestionsOpen(true);
                }}
                onBlur={(event) => {
                  vendorField.onBlur(event);
                  setVendorSuggestionsOpen(false);
                  setHighlightedVendorIndex(-1);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setVendorSuggestionsOpen(true);
                    setHighlightedVendorIndex((currentIndex) => {
                      if (vendorSuggestions.length === 0) {
                        return -1;
                      }

                      return currentIndex >= vendorSuggestions.length - 1
                        ? 0
                        : currentIndex + 1;
                    });
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setVendorSuggestionsOpen(true);
                    setHighlightedVendorIndex((currentIndex) => {
                      if (vendorSuggestions.length === 0) {
                        return -1;
                      }

                      return currentIndex <= 0
                        ? vendorSuggestions.length - 1
                        : currentIndex - 1;
                    });
                  }

                  if (event.key === "Enter" && highlightedVendorIndex >= 0) {
                    event.preventDefault();
                    selectVendorSuggestion(vendorSuggestions[highlightedVendorIndex]);
                  }

                  if (event.key === "Escape") {
                    setVendorSuggestionsOpen(false);
                    setHighlightedVendorIndex(-1);
                  }
                }}
                name={vendorField.name}
                ref={(element) => {
                  vendorField.ref(element);
                  vendorInputRef.current = element;
                }}
                onChange={(event) => {
                  vendorField.onChange(event);
                  setVendorSuggestionsOpen(true);
                  setHighlightedVendorIndex(-1);
                }}
              />
              {shouldShowVendorSuggestions ? (
                <div
                  className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-lg"
                  id={vendorSuggestionsListId}
                  role="listbox"
                >
                  {vendorSuggestionsLoading ? (
                    <div className="px-3 py-2 text-sm text-stone-500">Loading vendors...</div>
                  ) : (
                    vendorSuggestions.map((vendor, index) => (
                      <button
                        key={vendor}
                        type="button"
                        role="option"
                        aria-selected={index === highlightedVendorIndex}
                        className={`flex w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          index === highlightedVendorIndex
                            ? "bg-stone-950 text-white"
                            : "text-stone-700 hover:bg-stone-100"
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onMouseEnter={() => {
                          setHighlightedVendorIndex(index);
                        }}
                        onClick={() => {
                          selectVendorSuggestion(vendor);
                        }}
                      >
                        {vendor}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-4">
              <span className="text-sm font-medium text-stone-700">Description</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                {...register("description")}
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isSubmitting || categoriesLoading || categories.length === 0}
              >
                {isSubmitting ? "Saving..." : "Add transaction"}
              </button>
            </div>

            {submitError ? (
              <p className="text-sm text-red-600 md:col-span-2 xl:col-span-5">
                {submitError}
              </p>
            ) : null}
          </form>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-stone-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Monthly view
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                {monthLabel}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Month</span>
                <input
                  type="month"
                  autoComplete="off"
                  value={selectedMonth}
                  onChange={(event) => {
                    if (event.target.value) {
                      setSelectedMonth(event.target.value);
                      setFilterDateFrom("");
                      setFilterDateTo("");
                    }
                  }}
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4 border-b border-stone-200 px-6 py-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-stone-500">Category</span>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-stone-500">From</span>
              <input
                type="date"
                autoComplete="off"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-stone-500">To</span>
              <input
                type="date"
                autoComplete="off"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
              />
            </label>

            {(filterCategoryId || filterDateFrom || filterDateTo) ? (
              <button
                type="button"
                onClick={() => {
                  setFilterCategoryId("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                }}
                className="h-9 rounded-lg px-3 text-sm font-medium text-stone-500 transition hover:text-stone-950"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {transactionsError ? (
            <div className="px-6 pt-4">
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {transactionsError}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto px-6 py-6">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-sm text-stone-500">
                  <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                    <button
                      type="button"
                      onClick={() => setSortDirection((d) => d === "desc" ? "asc" : "desc")}
                      className="inline-flex items-center gap-1 transition hover:text-stone-950"
                    >
                      Date
                      <span className="text-xs">{sortDirection === "desc" ? "↓" : "↑"}</span>
                    </button>
                  </th>
                  <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                    Category
                  </th>
                  <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                    Vendor
                  </th>
                  <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                    Description
                  </th>
                  <th className="border-b border-stone-200 pb-3 pr-4 text-right font-medium">
                    Amount
                  </th>
                  <th className="border-b border-stone-200 pb-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactionsLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-sm text-stone-500"
                    >
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-sm text-stone-500"
                    >
                      {transactions.length === 0
                        ? "No transactions found for this month."
                        : "No transactions match your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const bgColor = transaction.category.colorCode ?? "#a8a29e";
                    const isEditing = editingId === transaction.id;

                    if (isEditing) {
                      return (
                        <tr key={transaction.id} className="bg-stone-50">
                          <td colSpan={6} className="border-b border-stone-200 px-0 py-4">
                            <form
                              className="grid gap-3 px-2 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
                              onSubmit={handleSubmitEdit(onEditSubmit)}
                              data-form-type="other"
                              autoComplete="off"
                            >
                              <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-stone-500">Category</span>
                                <select
                                  className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                                  disabled={categoriesLoading || isEditSubmitting}
                                  {...registerEdit("categoryId")}
                                >
                                  <option value="">Select a category</option>
                                  {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                                {editErrors.categoryId ? (
                                  <p className="text-xs text-red-600">{editErrors.categoryId.message}</p>
                                ) : null}
                              </label>

                              <div className="flex flex-col gap-1 sm:col-span-2">
                                <span className="text-xs font-medium text-stone-500">Amounts</span>
                                <div className="space-y-2">
                                  {editLineItemFields.map((field, index) => (
                                    <div key={field.id} className="flex items-start gap-2">
                                      <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        inputMode="decimal"
                                        className="h-9 flex-1 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                                        disabled={isEditSubmitting}
                                        placeholder="0.00"
                                        aria-label={`Edit amount ${index + 1}`}
                                        {...registerEdit(`lineItems.${index}.amount`)}
                                      />
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        onClick={() => {
                                          if (editLineItemFields.length === 1) {
                                            resetEdit({
                                              ...getEditValues(),
                                              lineItems: [createEmptyLineItem()],
                                            });
                                            return;
                                          }

                                          removeEditLineItem(index);
                                        }}
                                        disabled={isEditSubmitting}
                                        className="h-9 rounded-lg border border-stone-300 px-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-start">
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => appendEditLineItem(createEmptyLineItem())}
                                    disabled={isEditSubmitting}
                                    className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                                  >
                                    Add amount
                                  </button>
                                </div>
                                {editErrors.lineItems ? (
                                  <p className="text-xs text-red-600">
                                    {getLineItemsErrorMessage(editErrors.lineItems)}
                                  </p>
                                ) : null}
                              </div>

                              <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-stone-500">Date</span>
                                <input
                                  type="date"
                                  className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                                  disabled={isEditSubmitting}
                                  autoComplete="off"
                                  data-form-type="other"
                                  {...registerEdit("transactionDate")}
                                />
                                {editErrors.transactionDate ? (
                                  <p className="text-xs text-red-600">{editErrors.transactionDate.message}</p>
                                ) : null}
                              </label>

                              <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-stone-500">Vendor</span>
                                <input
                                  type="text"
                                  className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                                  disabled={isEditSubmitting}
                                  placeholder="Optional"
                                  {...registerEdit("vendor")}
                                />
                              </label>

                              <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-stone-500">Description</span>
                                <input
                                  type="text"
                                  className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                                  disabled={isEditSubmitting}
                                  placeholder="Optional"
                                  {...registerEdit("description")}
                                />
                              </label>

                              <div className="flex items-end gap-2">
                                <button
                                  type="submit"
                                  disabled={isEditSubmitting}
                                  className="h-9 rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                                >
                                  {isEditSubmitting ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  disabled={isEditSubmitting}
                                  className="h-9 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                                >
                                  Cancel
                                </button>
                              </div>

                              {editError ? (
                                <p className="text-xs text-red-600 sm:col-span-2 lg:col-span-6">
                                  {editError}
                                </p>
                              ) : null}
                            </form>
                          </td>
                        </tr>
                      );
                    }

                    return (
                    <tr
                      key={transaction.id}
                      className="cursor-pointer text-sm text-stone-700 transition hover:bg-stone-50"
                      onClick={() => handleStartEdit(transaction)}
                    >
                      <td className="border-b border-stone-100 py-4 pr-4 whitespace-nowrap">
                        {formatTransactionDisplayDate(transaction.transactionDate)}
                      </td>
                      <td className="border-b border-stone-100 py-4 pr-4">
                        <span
                          className="inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: bgColor,
                            color: isLightColor(bgColor)
                              ? "#1c1917"
                              : "#ffffff",
                          }}
                        >
                          {transaction.category.name}
                        </span>
                      </td>
                      <td className="border-b border-stone-100 py-4 pr-4">
                        {transaction.vendor || "—"}
                      </td>
                      <td className="border-b border-stone-100 py-4 pr-4">
                        {transaction.description || "—"}
                      </td>
                      <td className="border-b border-stone-100 py-4 pr-4 text-right font-medium whitespace-nowrap text-stone-950">
                        <div className="flex flex-col items-end">
                          <span>{amountFormatter.format(Number(transaction.amount))}</span>
                          {transaction.lineItems.length > 1 ? (
                            <span className="text-xs font-normal text-stone-500">
                              {transaction.lineItems.length} items
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-stone-100 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(transaction.id);
                          }}
                          disabled={deleteId === transaction.id}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                        >
                          {deleteId === transaction.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
