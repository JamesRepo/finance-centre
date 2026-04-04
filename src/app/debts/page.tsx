"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const today = new Date();
const defaultDate = format(today, "yyyy-MM-dd");
const autofillGuardProps = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
} as const;

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});

const debtTypeOptions = [
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "STUDENT_LOAN", label: "Student Loan" },
  { value: "PERSONAL_LOAN", label: "Personal Loan" },
  { value: "OTHER", label: "Other" },
] as const;

const debtTypeLabelMap = Object.fromEntries(
  debtTypeOptions.map((option) => [option.value, option.label]),
) as Record<DebtType, string>;

const optionalNumber = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().nonnegative().optional(),
);

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },
  z.string().trim().optional(),
);

const debtFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a debt name"),
  debtType: z.enum(["CREDIT_CARD", "STUDENT_LOAN", "PERSONAL_LOAN", "OTHER"], {
    message: "Select a debt type",
  }),
  originalBalance: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Original balance must be greater than 0"),
  ),
  interestRate: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().nonnegative("Interest rate cannot be negative"),
  ),
  minimumPayment: optionalNumber,
  startDate: optionalTrimmedString,
  targetPayoffDate: optionalTrimmedString,
  notes: optionalTrimmedString,
});

const debtEditFormSchema = debtFormSchema.extend({
  isActive: z.boolean(),
});

const paymentFormSchema = z.object({
  amount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Payment amount must be greater than 0"),
  ),
  interestAmount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().nonnegative("Interest amount cannot be negative").optional(),
  ),
  paymentDate: z.string().min(1, "Enter a payment date"),
  note: optionalTrimmedString,
}).refine(
  (value) => (value.interestAmount ?? 0) <= value.amount,
  {
    message: "Interest amount cannot exceed the payment amount",
    path: ["interestAmount"],
  },
);

const paymentEditFormSchema = z.object({
  amount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Payment amount must be greater than 0"),
  ),
  paymentDate: z.string().min(1, "Enter a payment date"),
  note: optionalTrimmedString,
});

type DebtType = (typeof debtTypeOptions)[number]["value"];

type DebtPayment = {
  id: number;
  debtId: number;
  amount: string;
  interestAmount: string;
  paymentDate: string;
  note: string | null;
  createdAt: string;
};

type Debt = {
  id: number;
  name: string;
  debtType: DebtType;
  originalBalance: string;
  interestRate: string;
  minimumPayment: string | null;
  startDate: string | null;
  targetPayoffDate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  debtPayments: DebtPayment[];
  totalPaid: string;
  totalInterestPaid: string;
  principalPaid: string;
  paymentCount: number;
  currentBalance: string;
};

type DebtFormValues = z.input<typeof debtFormSchema>;
type DebtFormSubmitValues = z.output<typeof debtFormSchema>;
type DebtEditFormValues = z.input<typeof debtEditFormSchema>;
type DebtEditFormSubmitValues = z.output<typeof debtEditFormSchema>;
type PaymentFormValues = z.input<typeof paymentFormSchema>;
type PaymentFormSubmitValues = z.output<typeof paymentFormSchema>;
type PaymentEditFormValues = z.input<typeof paymentEditFormSchema>;
type PaymentEditFormSubmitValues = z.output<typeof paymentEditFormSchema>;

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatPercent(value: number) {
  return percentFormatter.format(value / 100);
}

function formatDisplayDate(value: string | null) {
  if (!value) {
    return null;
  }

  return format(new Date(value), "d MMM yyyy");
}

function formatInputDate(value: string) {
  return value.slice(0, 10);
}

function sortPayments(payments: DebtPayment[]) {
  return [...payments].sort(
    (left, right) =>
      new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime(),
  );
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

function DebtCard({
  debt,
  expanded,
  deletingDebtId,
  deletingPaymentId,
  onTogglePaymentForm,
  onUpdateDebt,
  onDeleteDebt,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
}: {
  debt: Debt;
  expanded: boolean;
  deletingDebtId: number | null;
  deletingPaymentId: number | null;
  onTogglePaymentForm: (debtId: number) => void;
  onUpdateDebt: (
    debtId: number,
    values: DebtEditFormSubmitValues,
  ) => Promise<string | null>;
  onDeleteDebt: (debtId: number) => Promise<string | null>;
  onAddPayment: (debtId: number, values: PaymentFormSubmitValues) => Promise<string | null>;
  onUpdatePayment: (
    debtId: number,
    payment: DebtPayment,
    values: PaymentEditFormSubmitValues,
  ) => Promise<string | null>;
  onDeletePayment: (debtId: number, paymentId: number) => Promise<string | null>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues, undefined, PaymentFormSubmitValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: undefined,
      interestAmount: undefined,
      paymentDate: defaultDate,
      note: "",
    },
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingDebt, setEditingDebt] = useState(false);
  const [editDebtSubmitError, setEditDebtSubmitError] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [showPayments, setShowPayments] = useState(false);
  const {
    register: registerDebtEdit,
    handleSubmit: handleDebtEditSubmit,
    reset: resetDebtEdit,
    formState: {
      errors: debtEditErrors,
      isSubmitting: isDebtEditSubmitting,
    },
  } = useForm<DebtEditFormValues, undefined, DebtEditFormSubmitValues>({
    resolver: zodResolver(debtEditFormSchema),
    defaultValues: {
      name: debt.name,
      debtType: debt.debtType,
      originalBalance: Number(debt.originalBalance),
      interestRate: Number(debt.interestRate),
      minimumPayment:
        debt.minimumPayment !== null ? Number(debt.minimumPayment) : undefined,
      startDate: debt.startDate ? formatInputDate(debt.startDate) : "",
      targetPayoffDate: debt.targetPayoffDate
        ? formatInputDate(debt.targetPayoffDate)
        : "",
      isActive: debt.isActive,
      notes: debt.notes ?? "",
    },
  });
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<PaymentEditFormValues, undefined, PaymentEditFormSubmitValues>({
    resolver: zodResolver(paymentEditFormSchema),
    defaultValues: {
      amount: undefined,
      paymentDate: defaultDate,
      note: "",
    },
  });

  const originalBalance = Number(debt.originalBalance);
  const principalPaid = Number(debt.principalPaid);
  const currentBalance = Number(debt.currentBalance);
  const progressRatio =
    originalBalance > 0 ? Math.min(principalPaid / originalBalance, 1) : 0;
  const recentPayments = useMemo(
    () => sortPayments(debt.debtPayments),
    [debt.debtPayments],
  );

  async function submitPayment(values: PaymentFormSubmitValues) {
    setSubmitError(null);

    const error = await onAddPayment(debt.id, values);

    if (error) {
      setSubmitError(error);
      return;
    }

    setShowPayments(true);
    reset({
      amount: undefined,
      interestAmount: undefined,
      paymentDate: defaultDate,
      note: "",
    });
  }

  function startEditingDebt() {
    setEditDebtSubmitError(null);
    setEditingDebt(true);
    resetDebtEdit({
      name: debt.name,
      debtType: debt.debtType,
      originalBalance: Number(debt.originalBalance),
      interestRate: Number(debt.interestRate),
      minimumPayment:
        debt.minimumPayment !== null ? Number(debt.minimumPayment) : undefined,
      startDate: debt.startDate ? formatInputDate(debt.startDate) : "",
      targetPayoffDate: debt.targetPayoffDate
        ? formatInputDate(debt.targetPayoffDate)
        : "",
      isActive: debt.isActive,
      notes: debt.notes ?? "",
    });
  }

  function cancelEditingDebt() {
    setEditDebtSubmitError(null);
    setEditingDebt(false);
  }

  async function submitEditedDebt(values: DebtEditFormSubmitValues) {
    setEditDebtSubmitError(null);

    const error = await onUpdateDebt(debt.id, values);

    if (error) {
      setEditDebtSubmitError(error);
      return;
    }

    cancelEditingDebt();
  }

  async function deleteDebt() {
    const confirmed = window.confirm(
      `Delete ${debt.name}? This will permanently remove the debt and all of its recorded payments.`,
    );

    if (!confirmed) {
      return;
    }

    await onDeleteDebt(debt.id);
  }

  function startEditingPayment(payment: DebtPayment) {
    setEditSubmitError(null);
    setShowPayments(true);
    setEditingPaymentId(payment.id);
    resetEdit({
      amount: Number(payment.amount),
      paymentDate: formatInputDate(payment.paymentDate),
      note: payment.note ?? "",
    });
  }

  function cancelEditingPayment() {
    setEditSubmitError(null);
    setEditingPaymentId(null);
    resetEdit({
      amount: undefined,
      paymentDate: defaultDate,
      note: "",
    });
  }

  async function submitEditedPayment(values: PaymentEditFormSubmitValues) {
    if (editingPaymentId === null) {
      return;
    }

    setEditSubmitError(null);

    const payment = debt.debtPayments.find(
      (item) => item.id === editingPaymentId,
    );

    if (!payment) {
      setEditSubmitError("Payment not found");
      return;
    }

    const error = await onUpdatePayment(debt.id, payment, values);

    if (error) {
      setEditSubmitError(error);
      return;
    }

    cancelEditingPayment();
  }

  return (
    <article
      className={
        debt.isActive
          ? "rounded-[2rem] border border-stone-200 bg-white shadow-sm"
          : "rounded-[2rem] border border-stone-200 bg-stone-100 text-stone-500 shadow-sm"
      }
    >
      <div className="flex flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                className={
                  debt.isActive
                    ? "text-2xl font-semibold tracking-tight text-stone-950"
                    : "text-2xl font-semibold tracking-tight text-stone-700"
                }
              >
                {debt.name}
              </h2>
              <span
                className={
                  debt.isActive
                    ? "rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-white uppercase"
                    : "rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-stone-600 uppercase"
                }
              >
                {debtTypeLabelMap[debt.debtType]}
              </span>
              {!debt.isActive ? (
                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-medium text-stone-600">
                  Inactive
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <p>
                <span className="font-medium">Interest rate:</span>{" "}
                {formatPercent(Number(debt.interestRate))}
              </p>
              {debt.minimumPayment !== null ? (
                <p>
                  <span className="font-medium">Minimum payment:</span>{" "}
                  {formatCurrency(Number(debt.minimumPayment))}
                </p>
              ) : null}
              {debt.startDate ? (
                <p>
                  <span className="font-medium">Started:</span>{" "}
                  {formatDisplayDate(debt.startDate)}
                </p>
              ) : null}
              {debt.targetPayoffDate ? (
                <p>
                  <span className="font-medium">Target payoff:</span>{" "}
                  {formatDisplayDate(debt.targetPayoffDate)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div
              className={
                debt.isActive
                  ? "rounded-[1.5rem] bg-stone-950 px-5 py-4 text-right text-white"
                  : "rounded-[1.5rem] border border-stone-300 bg-white px-5 py-4 text-right text-stone-700"
              }
            >
              <p className="text-sm font-medium">Current balance</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatCurrency(currentBalance)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={editingDebt ? cancelEditingDebt : startEditingDebt}
                disabled={deletingDebtId === debt.id}
                className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300"
              >
                {editingDebt ? "Cancel edit" : "Edit details"}
              </button>
              {!debt.isActive ? (
                <button
                  type="button"
                  onClick={() => void deleteDebt()}
                  disabled={deletingDebtId === debt.id}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  {deletingDebtId === debt.id ? "Deleting..." : "Delete debt"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {editingDebt ? (
          <form
            className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={handleDebtEditSubmit(submitEditedDebt)}
            autoComplete="off"
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Name</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                placeholder="e.g. Barclaycard"
                {...autofillGuardProps}
                {...registerDebtEdit("name")}
              />
              {debtEditErrors.name ? (
                <p className="text-sm text-red-600">{debtEditErrors.name.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Debt type</span>
              <select
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                {...registerDebtEdit("debtType")}
              >
                {debtTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {debtEditErrors.debtType ? (
                <p className="text-sm text-red-600">
                  {debtEditErrors.debtType.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Original balance
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                placeholder="0.00"
                {...registerDebtEdit("originalBalance")}
              />
              {debtEditErrors.originalBalance ? (
                <p className="text-sm text-red-600">
                  {debtEditErrors.originalBalance.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Interest rate (%)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                placeholder="0.00"
                {...registerDebtEdit("interestRate")}
              />
              {debtEditErrors.interestRate ? (
                <p className="text-sm text-red-600">
                  {debtEditErrors.interestRate.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Minimum payment
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                placeholder="Optional"
                {...registerDebtEdit("minimumPayment")}
              />
              {debtEditErrors.minimumPayment ? (
                <p className="text-sm text-red-600">
                  {debtEditErrors.minimumPayment.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Start date</span>
              <input
                type="date"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                {...autofillGuardProps}
                {...registerDebtEdit("startDate")}
              />
              {debtEditErrors.startDate ? (
                <p className="text-sm text-red-600">
                  {debtEditErrors.startDate.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Target payoff date
              </span>
              <input
                type="date"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                {...autofillGuardProps}
                {...registerDebtEdit("targetPayoffDate")}
              />
              {debtEditErrors.targetPayoffDate ? (
                <p className="text-sm text-red-600">
                  {debtEditErrors.targetPayoffDate.message}
                </p>
              ) : null}
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-950"
                disabled={isDebtEditSubmitting}
                {...registerDebtEdit("isActive")}
              />
              Active debt
            </label>

            <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium text-stone-700">Notes</span>
              <textarea
                className="min-h-28 rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isDebtEditSubmitting}
                placeholder="Optional"
                {...registerDebtEdit("notes")}
              />
              {debtEditErrors.notes ? (
                <p className="text-sm text-red-600">{debtEditErrors.notes.message}</p>
              ) : null}
            </label>

            <div className="flex items-end md:col-span-2 xl:col-span-1">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isDebtEditSubmitting}
              >
                {isDebtEditSubmitting ? "Saving..." : "Save debt"}
              </button>
            </div>

            {editDebtSubmitError ? (
              <p className="text-sm text-red-600 md:col-span-2 xl:col-span-4">
                {editDebtSubmitError}
              </p>
            ) : null}
          </form>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
          <div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className={debt.isActive ? "text-stone-600" : "text-stone-500"}>
                Principal paid {formatCurrency(principalPaid)} of {formatCurrency(originalBalance)}
              </p>
              <p
                className={
                  debt.isActive ? "font-medium text-stone-950" : "font-medium text-stone-600"
                }
              >
                {formatPercent(progressRatio * 100)}
              </p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-200">
              <div
                className={debt.isActive ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-stone-400"}
                style={{ width: `${progressRatio * 100}%` }}
              />
            </div>
          </div>

          <div className="flex justify-start lg:justify-end">
            <button
              type="button"
              onClick={() => onTogglePaymentForm(debt.id)}
              className={
                debt.isActive
                  ? "h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                  : "h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400"
              }
            >
              {expanded ? "Hide payment form" : "Add payment"}
            </button>
          </div>
        </div>

        {expanded ? (
          <form
            className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={handleSubmit(submitPayment)}
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="0.00"
                {...register("amount")}
              />
              {errors.amount ? (
                <p className="text-sm text-red-600">{errors.amount.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Date</span>
              <input
                type="date"
                autoComplete="off"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("paymentDate")}
              />
              {errors.paymentDate ? (
                <p className="text-sm text-red-600">{errors.paymentDate.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Interest amount
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                {...register("interestAmount")}
              />
              {errors.interestAmount ? (
                <p className="text-sm text-red-600">
                  {errors.interestAmount.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-1">
              <span className="text-sm font-medium text-stone-700">Note</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                {...register("note")}
              />
            </label>

            <div className="flex items-end md:col-span-2 xl:col-span-1">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save payment"}
              </button>
            </div>

            {submitError ? (
              <p className="text-sm text-red-600 md:col-span-2 xl:col-span-4">
                {submitError}
              </p>
            ) : null}
          </form>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3
                className={
                  debt.isActive
                    ? "text-lg font-semibold text-stone-950"
                    : "text-lg font-semibold text-stone-700"
                }
              >
                Payment history
              </h3>
              <p className="text-sm text-stone-500">Full history</p>
            </div>
            {recentPayments.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowPayments((current) => !current)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
              >
                {showPayments ? "Hide payments" : `Show payments (${recentPayments.length})`}
              </button>
            ) : null}
          </div>

          {recentPayments.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-stone-300 px-4 py-4 text-sm">
              No payments recorded yet.
            </p>
          ) : !showPayments ? (
            <p className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-500">
              Payment history hidden.
            </p>
          ) : (
            <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-white">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {editingPaymentId === payment.id ? (
                    <form
                      className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_220px_auto]"
                      onSubmit={handleEditSubmit(submitEditedPayment)}
                    >
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Amount
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                          disabled={isEditSubmitting}
                          placeholder="0.00"
                          {...registerEdit("amount")}
                        />
                        {editErrors.amount ? (
                          <p className="text-sm text-red-600">
                            {editErrors.amount.message}
                          </p>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-stone-700">
                          Date
                        </span>
                        <input
                          type="date"
                          autoComplete="off"
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                          disabled={isEditSubmitting}
                          {...registerEdit("paymentDate")}
                        />
                        {editErrors.paymentDate ? (
                          <p className="text-sm text-red-600">
                            {editErrors.paymentDate.message}
                          </p>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-1">
                        <span className="text-sm font-medium text-stone-700">
                          Note
                        </span>
                        <input
                          type="text"
                          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                          disabled={isEditSubmitting}
                          placeholder="Optional"
                          {...registerEdit("note")}
                        />
                      </label>

                      <div className="flex items-end gap-3 md:col-span-2 xl:col-span-1">
                        <button
                          type="submit"
                          className="h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                          disabled={isEditSubmitting}
                        >
                          {isEditSubmitting ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingPayment}
                          className="h-11 rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:text-stone-400"
                          disabled={isEditSubmitting}
                        >
                          Cancel
                        </button>
                      </div>

                      {editSubmitError ? (
                        <p className="text-sm text-red-600 md:col-span-2 xl:col-span-4">
                          {editSubmitError}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium text-stone-950">
                          {formatDisplayDate(payment.paymentDate)}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {payment.note || "No note"}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Interest {formatCurrency(Number(payment.interestAmount))} · Principal{" "}
                          {formatCurrency(
                            Number(payment.amount) - Number(payment.interestAmount),
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <p className="mr-2 text-lg font-semibold text-stone-950">
                          {formatCurrency(Number(payment.amount))}
                        </p>
                        <button
                          type="button"
                          onClick={() => startEditingPayment(payment)}
                          disabled={deletingPaymentId === payment.id}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeletePayment(debt.id, payment.id)}
                          disabled={deletingPaymentId === payment.id}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                        >
                          {deletingPaymentId === payment.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {debt.notes ? (
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-sm font-medium text-stone-700">Notes</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{debt.notes}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedDebtId, setExpandedDebtId] = useState<number | null>(null);
  const [deletingDebtId, setDeletingDebtId] = useState<number | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [showInactiveDebts, setShowInactiveDebts] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DebtFormValues, undefined, DebtFormSubmitValues>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      name: "",
      debtType: "CREDIT_CARD",
      originalBalance: undefined,
      interestRate: undefined,
      minimumPayment: undefined,
      startDate: "",
      targetPayoffDate: "",
      notes: "",
    },
  });

  async function loadDebts() {
    setLoading(true);
    setPageError(null);

    try {
      const response = await fetch("/api/debts", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load debts"));
      }

      const data = (await response.json()) as Debt[];
      setDebts(data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load debts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDebts();
  }, []);

  const summary = useMemo(() => {
    const activeDebts = debts.filter((debt) => debt.isActive);

    return {
      totalRemaining: activeDebts.reduce(
        (sum, debt) => sum + Number(debt.currentBalance),
        0,
      ),
      totalPaid: debts.reduce((sum, debt) => sum + Number(debt.totalPaid), 0),
      activeCount: activeDebts.length,
    };
  }, [debts]);

  const visibleDebts = useMemo(
    () => debts.filter((debt) => showInactiveDebts || debt.isActive),
    [debts, showInactiveDebts],
  );

  async function onSubmit(values: DebtFormSubmitValues) {
    setSubmitError(null);

    try {
      const response = await fetch("/api/debts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: values.name.trim(),
          debtType: values.debtType,
          originalBalance: values.originalBalance,
          interestRate: values.interestRate,
          minimumPayment: values.minimumPayment,
          startDate: values.startDate || undefined,
          targetPayoffDate: values.targetPayoffDate || undefined,
          notes: values.notes?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create debt"));
      }

      reset({
        name: "",
        debtType: "CREDIT_CARD",
        originalBalance: undefined,
        interestRate: undefined,
        minimumPayment: undefined,
        startDate: "",
        targetPayoffDate: "",
        notes: "",
      });
      await loadDebts();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create debt");
    }
  }

  async function handleAddPayment(
    debtId: number,
    values: PaymentFormSubmitValues,
  ) {
    try {
      const response = await fetch(`/api/debts/${debtId}/payments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: values.amount,
          interestAmount: values.interestAmount ?? 0,
          paymentDate: values.paymentDate,
          note: values.note?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to add payment"));
      }

      await loadDebts();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Failed to add payment";
    }
  }

  async function handleUpdateDebt(
    debtId: number,
    values: DebtEditFormSubmitValues,
  ) {
    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: values.name.trim(),
          debtType: values.debtType,
          originalBalance: values.originalBalance,
          interestRate: values.interestRate,
          minimumPayment: values.minimumPayment ?? null,
          startDate: values.startDate || null,
          targetPayoffDate: values.targetPayoffDate || null,
          isActive: values.isActive,
          notes: values.notes?.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update debt"));
      }

      await loadDebts();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Failed to update debt";
    }
  }

  async function handleDeleteDebt(debtId: number) {
    setDeletingDebtId(debtId);
    setPageError(null);

    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete debt"));
      }

      if (expandedDebtId === debtId) {
        setExpandedDebtId(null);
      }

      await loadDebts();
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete debt";
      setPageError(message);
      return message;
    } finally {
      setDeletingDebtId(null);
    }
  }

  async function handleDeletePayment(debtId: number, paymentId: number) {
    setDeletingPaymentId(paymentId);
    setPageError(null);

    try {
      const response = await fetch(`/api/debts/${debtId}/payments/${paymentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete payment"));
      }

      await loadDebts();
      return null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete payment";
      setPageError(message);
      return message;
    } finally {
      setDeletingPaymentId(null);
    }
  }

  async function handleUpdatePayment(
    debtId: number,
    payment: DebtPayment,
    values: PaymentEditFormSubmitValues,
  ) {
    try {
      const response = await fetch(`/api/debts/${debtId}/payments/${payment.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: values.amount,
          interestAmount: Number(payment.interestAmount),
          paymentDate: values.paymentDate,
          note: values.note?.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update payment"));
      }

      await loadDebts();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Failed to update payment";
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="app-hero-surface border-b border-stone-200 px-6 py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Debts
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                  Debt management
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  Track balances, record payments, and keep active obligations in
                  view.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label="Debt remaining"
                  value={formatCurrency(summary.totalRemaining)}
                  tone="dark"
                />
                <SummaryCard
                  label="Total paid"
                  value={formatCurrency(summary.totalPaid)}
                  tone="light"
                />
                <SummaryCard
                  label="Active debts"
                  value={String(summary.activeCount)}
                  tone="light"
                />
              </div>
            </div>
          </div>

          <form
            className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={handleSubmit(onSubmit)}
            autoComplete="off"
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Name</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="e.g. Barclaycard"
                {...autofillGuardProps}
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Debt type</span>
              <select
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("debtType")}
              >
                {debtTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.debtType ? (
                <p className="text-sm text-red-600">{errors.debtType.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Original balance
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="0.00"
                {...register("originalBalance")}
              />
              {errors.originalBalance ? (
                <p className="text-sm text-red-600">
                  {errors.originalBalance.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Interest rate (%)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="0.00"
                {...register("interestRate")}
              />
              {errors.interestRate ? (
                <p className="text-sm text-red-600">{errors.interestRate.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Minimum payment
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                {...register("minimumPayment")}
              />
              {errors.minimumPayment ? (
                <p className="text-sm text-red-600">
                  {errors.minimumPayment.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Start date</span>
              <input
                type="date"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...autofillGuardProps}
                {...register("startDate")}
              />
              {errors.startDate ? (
                <p className="text-sm text-red-600">{errors.startDate.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Target payoff date
              </span>
              <input
                type="date"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...autofillGuardProps}
                {...register("targetPayoffDate")}
              />
              {errors.targetPayoffDate ? (
                <p className="text-sm text-red-600">
                  {errors.targetPayoffDate.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-1">
              <span className="text-sm font-medium text-stone-700">Notes</span>
              <textarea
                className="min-h-28 rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                {...register("notes")}
              />
              {errors.notes ? (
                <p className="text-sm text-red-600">{errors.notes.message}</p>
              ) : null}
            </label>

            <div className="flex items-end md:col-span-2 xl:col-span-1">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Add debt"}
              </button>
            </div>

            {submitError ? (
              <p className="text-sm text-red-600 md:col-span-2 xl:col-span-4">
                {submitError}
              </p>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-stone-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Portfolio
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                Debt accounts
              </h2>
            </div>

            <label className="flex items-center gap-3 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={showInactiveDebts}
                onChange={(event) => setShowInactiveDebts(event.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-950"
              />
              Show inactive debts
            </label>
          </div>

          {pageError ? (
            <div className="px-6 pt-4">
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {pageError}
              </p>
            </div>
          ) : null}

          <div className="px-6 py-6">
            {loading ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-sm text-stone-500">
                Loading debts...
              </div>
            ) : visibleDebts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                {showInactiveDebts
                  ? "No debts have been added yet."
                  : "No active debts found. Toggle inactive debts to view archived accounts."}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {visibleDebts.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    expanded={expandedDebtId === debt.id}
                    deletingDebtId={deletingDebtId}
                    deletingPaymentId={deletingPaymentId}
                    onTogglePaymentForm={(debtId) =>
                      setExpandedDebtId((currentId) =>
                        currentId === debtId ? null : debtId,
                      )
                    }
                    onUpdateDebt={handleUpdateDebt}
                    onDeleteDebt={handleDeleteDebt}
                    onAddPayment={handleAddPayment}
                    onUpdatePayment={handleUpdatePayment}
                    onDeletePayment={handleDeletePayment}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
