"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatMonthLabel, shiftMonthValue } from "@/lib/months";

const holidayExpenseTypeOptions = [
  { value: "FLIGHT", label: "Flight", colorClass: "bg-sky-500" },
  { value: "ACCOMMODATION", label: "Accommodation", colorClass: "bg-violet-500" },
  { value: "FOOD", label: "Food", colorClass: "bg-orange-500" },
  { value: "TRANSPORT", label: "Transport", colorClass: "bg-emerald-500" },
  { value: "ACTIVITY", label: "Activity", colorClass: "bg-pink-500" },
  { value: "SHOPPING", label: "Shopping", colorClass: "bg-red-500" },
  { value: "OTHER", label: "Other", colorClass: "bg-stone-400" },
] as const;

type HolidayExpenseType = (typeof holidayExpenseTypeOptions)[number]["value"];

type HolidaySummary = {
  id: number;
  name: string;
  destination: string;
  assignedMonth: string;
  startDate: string;
  endDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  totalCost: string;
  expenseCount: number;
  expenseBreakdown: Array<{
    expenseType: HolidayExpenseType;
    totalCost: string;
  }>;
};

type HolidayDetail = HolidaySummary & {
  holidayExpenses: HolidayExpense[];
};

type HolidayExpense = {
  id: number;
  holidayId: number;
  expenseType: HolidayExpenseType;
  description: string;
  amount: string;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
};

type ExpenseFormState = {
  expenseType: HolidayExpenseType;
  description: string;
  amount: string;
  expenseDate: string;
  notes: string;
};

type AssignmentFormState = {
  assignedMonth: string;
};

type HolidayEditFormState = {
  name: string;
  startDate: string;
  endDate: string;
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const today = format(new Date(), "yyyy-MM-dd");
const currentMonth = format(new Date(), "yyyy-MM");

const holidayFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a holiday name"),
    destination: z.string().trim().min(1, "Enter a destination"),
    assignedMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Enter a month in YYYY-MM format"),
    startDate: z.string().min(1, "Enter a start date"),
    endDate: z.string().min(1, "Enter an end date"),
    description: z.string().trim().optional(),
  })
  .refine(
    (value) => new Date(value.endDate).getTime() >= new Date(value.startDate).getTime(),
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    },
  );

const holidayEditFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a holiday name"),
    startDate: z.string().min(1, "Enter a start date"),
    endDate: z.string().min(1, "Enter an end date"),
  })
  .refine(
    (value) => new Date(value.endDate).getTime() >= new Date(value.startDate).getTime(),
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    },
  );

type HolidayFormValues = z.input<typeof holidayFormSchema>;
type HolidayFormSubmitValues = z.output<typeof holidayFormSchema>;

const expenseFormSchema = z.object({
  expenseType: z.enum(
    holidayExpenseTypeOptions.map((option) => option.value) as [
      HolidayExpenseType,
      ...HolidayExpenseType[],
    ],
    {
      message: "Select an expense type",
    },
  ),
  description: z.string().trim().min(1, "Enter a description"),
  amount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Amount must be greater than 0"),
  ),
  expenseDate: z.string().min(1, "Enter a date"),
  notes: z.string().trim().optional(),
});

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function formatCurrency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function formatDisplayDate(value: string) {
  return format(new Date(value), "d MMM yyyy");
}

function buildDefaultExpenseFormState(holiday?: Pick<HolidaySummary, "startDate">): ExpenseFormState {
  return {
    expenseType: "FLIGHT",
    description: "",
    amount: "",
    expenseDate: holiday ? holiday.startDate.slice(0, 10) : today,
    notes: "",
  };
}

function buildHolidayEditFormState(
  holiday: Pick<HolidaySummary, "name" | "startDate" | "endDate">,
): HolidayEditFormState {
  return {
    name: holiday.name,
    startDate: holiday.startDate.slice(0, 10),
    endDate: holiday.endDate.slice(0, 10),
  };
}

function toHolidaySummary(holiday: HolidayDetail): HolidaySummary {
  const { holidayExpenses: _holidayExpenses, ...summary } = holiday;
  return summary;
}

function isActiveHoliday(holiday: Pick<HolidaySummary, "isActive" | "endDate">) {
  const todayAtMidnight = new Date();
  todayAtMidnight.setHours(0, 0, 0, 0);

  return holiday.isActive && new Date(holiday.endDate).getTime() >= todayAtMidnight.getTime();
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
        {value}
      </p>
    </div>
  );
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<HolidaySummary[]>([]);
  const [holidayDetails, setHolidayDetails] = useState<Record<number, HolidayDetail>>({});
  const [expandedHolidayId, setExpandedHolidayId] = useState<number | null>(null);
  const [expenseDrafts, setExpenseDrafts] = useState<Record<number, ExpenseFormState>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<number, AssignmentFormState>>({});
  const [holidayDrafts, setHolidayDrafts] = useState<Record<number, HolidayEditFormState>>({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expenseErrors, setExpenseErrors] = useState<Record<number, string>>({});
  const [assignmentErrors, setAssignmentErrors] = useState<Record<number, string>>({});
  const [holidayErrors, setHolidayErrors] = useState<Record<number, string>>({});
  const [expandedLoadingId, setExpandedLoadingId] = useState<number | null>(null);
  const [submittingExpenseId, setSubmittingExpenseId] = useState<number | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const [savingAssignmentId, setSavingAssignmentId] = useState<number | null>(null);
  const [savingHolidayId, setSavingHolidayId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues, undefined, HolidayFormSubmitValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: {
      name: "",
      destination: "",
      assignedMonth: currentMonth,
      startDate: today,
      endDate: today,
      description: "",
    },
  });
  const createAssignedMonth = watch("assignedMonth");

  async function loadHolidays() {
    setLoading(true);
    setPageError(null);

    try {
      const response = await fetch("/api/holidays", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load holidays"));
      }

      const data = (await response.json()) as HolidaySummary[];
      setHolidays(data);
      setExpenseDrafts((currentDrafts) =>
        Object.fromEntries(
          data.map((holiday) => [
            holiday.id,
            currentDrafts[holiday.id] ?? buildDefaultExpenseFormState(holiday),
          ]),
        ),
      );
      setAssignmentDrafts((currentDrafts) =>
        Object.fromEntries(
          data.map((holiday) => [
            holiday.id,
            currentDrafts[holiday.id] ?? { assignedMonth: holiday.assignedMonth },
          ]),
        ),
      );
      setHolidayDrafts((currentDrafts) =>
        Object.fromEntries(
          data.map((holiday) => [
            holiday.id,
            currentDrafts[holiday.id] ?? buildHolidayEditFormState(holiday),
          ]),
        ),
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHolidays();
  }, []);

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((left, right) => {
      const leftIsActive = isActiveHoliday(left);
      const rightIsActive = isActiveHoliday(right);

      if (leftIsActive !== rightIsActive) {
        return leftIsActive ? -1 : 1;
      }

      return new Date(right.startDate).getTime() - new Date(left.startDate).getTime();
    });
  }, [holidays]);

  const summary = useMemo(() => {
    const totalSpent = holidays.reduce((sum, holiday) => sum + Number(holiday.totalCost), 0);
    const totalHolidays = holidays.length;

    return {
      totalHolidays,
      totalSpent,
      averageCost: totalHolidays === 0 ? 0 : totalSpent / totalHolidays,
    };
  }, [holidays]);

  async function handleCreateHoliday(values: HolidayFormSubmitValues) {
    setSubmitError(null);

    try {
      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          description: values.description?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create holiday"));
      }

      const holiday = (await response.json()) as HolidaySummary;

      setPageError(null);
      setHolidays((currentHolidays) => [holiday, ...currentHolidays]);
      setExpenseDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holiday.id]: buildDefaultExpenseFormState(holiday),
      }));
      setAssignmentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holiday.id]: { assignedMonth: holiday.assignedMonth },
      }));
      setHolidayDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holiday.id]: buildHolidayEditFormState(holiday),
      }));
      reset({
        name: "",
        destination: "",
        assignedMonth: currentMonth,
        startDate: today,
        endDate: today,
        description: "",
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create holiday");
    }
  }

  async function handleToggleHoliday(holidayId: number) {
    if (expandedHolidayId === holidayId) {
      setExpandedHolidayId(null);
      return;
    }

    setExpandedHolidayId(holidayId);
    setExpenseErrors((currentErrors) => ({
      ...currentErrors,
      [holidayId]: "",
    }));
    setHolidayErrors((currentErrors) => ({
      ...currentErrors,
      [holidayId]: "",
    }));

    if (holidayDetails[holidayId]) {
      return;
    }

    setExpandedLoadingId(holidayId);

    try {
      const response = await fetch(`/api/holidays/${holidayId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load holiday details"));
      }

      const detail = (await response.json()) as HolidayDetail;
      setHolidayDetails((currentDetails) => ({
        ...currentDetails,
        [holidayId]: detail,
      }));
      setExpenseDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holidayId]: currentDrafts[holidayId] ?? buildDefaultExpenseFormState(detail),
      }));
      setAssignmentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holidayId]: currentDrafts[holidayId] ?? { assignedMonth: detail.assignedMonth },
      }));
      setHolidayDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holidayId]: currentDrafts[holidayId] ?? buildHolidayEditFormState(detail),
      }));
    } catch (error) {
      setExpenseErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]:
          error instanceof Error ? error.message : "Failed to load holiday details",
      }));
    } finally {
      setExpandedLoadingId(null);
    }
  }

  function handleExpenseDraftChange(
    holidayId: number,
    field: keyof ExpenseFormState,
    value: string,
  ) {
    setExpenseDrafts((currentDrafts) => ({
      ...currentDrafts,
      [holidayId]: {
        ...(currentDrafts[holidayId] ?? buildDefaultExpenseFormState()),
        [field]: value,
      },
    }));
  }

  function handleHolidayDraftChange(
    holidayId: number,
    field: keyof HolidayEditFormState,
    value: string,
  ) {
    setHolidayDrafts((currentDrafts) => ({
      ...currentDrafts,
      [holidayId]: {
        ...(currentDrafts[holidayId] ??
          buildHolidayEditFormState(
            holidays.find((holiday) => holiday.id === holidayId) ?? {
              name: "",
              startDate: today,
              endDate: today,
            },
          )),
        [field]: value,
      },
    }));
  }

  function handleAssignmentDraftChange(holidayId: number, assignedMonth: string) {
    setAssignmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [holidayId]: { assignedMonth },
    }));
  }

  async function refreshHolidayDetail(holidayId: number) {
    const response = await fetch(`/api/holidays/${holidayId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to refresh holiday"));
    }

    const detail = (await response.json()) as HolidayDetail;

    setHolidayDetails((currentDetails) => ({
      ...currentDetails,
      [holidayId]: detail,
    }));
    setHolidays((currentHolidays) =>
      currentHolidays.map((holiday) =>
        holiday.id === holidayId ? toHolidaySummary(detail) : holiday,
      ),
    );
    setAssignmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [holidayId]: { assignedMonth: detail.assignedMonth },
    }));
    setHolidayDrafts((currentDrafts) => ({
      ...currentDrafts,
      [holidayId]: buildHolidayEditFormState(detail),
    }));
  }

  async function handleSaveHoliday(holidayId: number) {
    const draft =
      holidayDrafts[holidayId] ??
      buildHolidayEditFormState(
        holidays.find((holiday) => holiday.id === holidayId) ?? {
          name: "",
          startDate: today,
          endDate: today,
        },
      );
    const parsedDraft = holidayEditFormSchema.safeParse(draft);

    if (!parsedDraft.success) {
      setHolidayErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]: parsedDraft.error.issues[0]?.message ?? "Invalid holiday",
      }));
      return;
    }

    setSavingHolidayId(holidayId);
    setHolidayErrors((currentErrors) => ({
      ...currentErrors,
      [holidayId]: "",
    }));

    try {
      const response = await fetch(`/api/holidays/${holidayId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: parsedDraft.data.name,
          startDate: parsedDraft.data.startDate,
          endDate: parsedDraft.data.endDate,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update holiday"));
      }

      const detail = (await response.json()) as HolidayDetail;
      setHolidayDetails((currentDetails) => ({
        ...currentDetails,
        [holidayId]: detail,
      }));
      setHolidays((currentHolidays) =>
        currentHolidays.map((holiday) =>
          holiday.id === holidayId ? toHolidaySummary(detail) : holiday,
        ),
      );
      setHolidayDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holidayId]: buildHolidayEditFormState(detail),
      }));
    } catch (error) {
      setHolidayErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]: error instanceof Error ? error.message : "Failed to update holiday",
      }));
    } finally {
      setSavingHolidayId(null);
    }
  }

  async function handleSaveAssignment(holidayId: number) {
    const draft = assignmentDrafts[holidayId];

    if (!draft || !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.assignedMonth)) {
      setAssignmentErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]: "Enter a month in YYYY-MM format",
      }));
      return;
    }

    setSavingAssignmentId(holidayId);
    setAssignmentErrors((currentErrors) => ({
      ...currentErrors,
      [holidayId]: "",
    }));

    try {
      const response = await fetch(`/api/holidays/${holidayId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          assignedMonth: draft.assignedMonth,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update assigned month"));
      }

      const detail = (await response.json()) as HolidayDetail;
      setHolidayDetails((currentDetails) => ({
        ...currentDetails,
        [holidayId]: detail,
      }));
      setHolidays((currentHolidays) =>
        currentHolidays.map((holiday) =>
          holiday.id === holidayId ? toHolidaySummary(detail) : holiday,
        ),
      );
      setAssignmentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holidayId]: { assignedMonth: detail.assignedMonth },
      }));
    } catch (error) {
      setAssignmentErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]:
          error instanceof Error ? error.message : "Failed to update assigned month",
      }));
    } finally {
      setSavingAssignmentId(null);
    }
  }

  async function handleAddExpense(holidayId: number) {
    const draft = expenseDrafts[holidayId] ?? buildDefaultExpenseFormState();
    const parsedDraft = expenseFormSchema.safeParse(draft);

    if (!parsedDraft.success) {
      setExpenseErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]: parsedDraft.error.issues[0]?.message ?? "Invalid expense",
      }));
      return;
    }

    setSubmittingExpenseId(holidayId);
    setExpenseErrors((currentErrors) => ({
      ...currentErrors,
      [holidayId]: "",
    }));

    try {
      const response = await fetch(`/api/holidays/${holidayId}/expenses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...parsedDraft.data,
          notes: parsedDraft.data.notes?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to add expense"));
      }

      await refreshHolidayDetail(holidayId);

      const holiday = holidays.find((entry) => entry.id === holidayId);
      setExpenseDrafts((currentDrafts) => ({
        ...currentDrafts,
        [holidayId]: buildDefaultExpenseFormState(holiday),
      }));
    } catch (error) {
      setExpenseErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]: error instanceof Error ? error.message : "Failed to add expense",
      }));
    } finally {
      setSubmittingExpenseId(null);
    }
  }

  async function handleDeleteExpense(holidayId: number, expenseId: number) {
    setDeletingExpenseId(expenseId);
    setExpenseErrors((currentErrors) => ({
      ...currentErrors,
      [holidayId]: "",
    }));

    try {
      const response = await fetch(`/api/holidays/${holidayId}/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete expense"));
      }

      await refreshHolidayDetail(holidayId);
    } catch (error) {
      setExpenseErrors((currentErrors) => ({
        ...currentErrors,
        [holidayId]: error instanceof Error ? error.message : "Failed to delete expense",
      }));
    } finally {
      setDeletingExpenseId(null);
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="app-hero-surface rounded-[2rem] border border-stone-200 px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Holidays
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                Track trip plans and spending
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                Add holidays, log trip costs, and compare spend across flights,
                stays, food, and everything else.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Total holidays tracked"
                value={String(summary.totalHolidays)}
              />
              <SummaryCard
                label="Total spent on holidays"
                value={formatCurrency(summary.totalSpent)}
              />
              <SummaryCard
                label="Average cost per holiday"
                value={formatCurrency(summary.averageCost)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
              Add a holiday
            </h2>
          </div>

          <form
            className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-5"
            onSubmit={handleSubmit(handleCreateHoliday)}
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Name</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Destination</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("destination")}
              />
              {errors.destination ? (
                <p className="text-sm text-red-600">{errors.destination.message}</p>
              ) : null}
            </label>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="holiday-assigned-month"
                className="text-sm font-medium text-stone-700"
              >
                Assigned month
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "assignedMonth",
                      shiftMonthValue(createAssignedMonth, -1),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                  disabled={isSubmitting}
                >
                  Previous
                </button>
                <input
                  id="holiday-assigned-month"
                  type="month"
                  autoComplete="off"
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                  disabled={isSubmitting}
                  {...register("assignedMonth")}
                />
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "assignedMonth",
                      shiftMonthValue(createAssignedMonth, 1),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                  className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                  disabled={isSubmitting}
                >
                  Next
                </button>
              </div>
              {errors.assignedMonth ? (
                <p className="text-sm text-red-600">{errors.assignedMonth.message}</p>
              ) : null}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Start date</span>
              <input
                type="date"
                autoComplete="off"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("startDate")}
              />
              {errors.startDate ? (
                <p className="text-sm text-red-600">{errors.startDate.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">End date</span>
              <input
                type="date"
                autoComplete="off"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("endDate")}
              />
              {errors.endDate ? (
                <p className="text-sm text-red-600">{errors.endDate.message}</p>
              ) : null}
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Add holiday"}
              </button>
            </div>

            <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-5">
              <span className="text-sm font-medium text-stone-700">Description</span>
              <textarea
                rows={3}
                className="rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                {...register("description")}
              />
            </label>

            {submitError ? (
              <p className="text-sm text-red-600 md:col-span-2 xl:col-span-5">
                {submitError}
              </p>
            ) : null}
          </form>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
              Holidays
            </h2>
          </div>

          {pageError ? (
            <div className="px-6 py-6">
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {pageError}
              </p>
            </div>
          ) : null}

          {!pageError ? (
            <div className="flex flex-col gap-4 px-6 py-6">
              {loading ? (
                <p className="text-sm text-stone-500">Loading holidays...</p>
              ) : sortedHolidays.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center text-sm text-stone-500">
                  No holidays have been added yet.
                </p>
              ) : (
                sortedHolidays.map((holiday) => {
                  const totalCost = Number(holiday.totalCost);
                  const detail = holidayDetails[holiday.id];
                  const isExpanded = expandedHolidayId === holiday.id;
                  const draft =
                    expenseDrafts[holiday.id] ?? buildDefaultExpenseFormState(holiday);
                  const assignmentDraft =
                    assignmentDrafts[holiday.id] ?? { assignedMonth: holiday.assignedMonth };
                  const holidayDraft =
                    holidayDrafts[holiday.id] ?? buildHolidayEditFormState(holiday);

                  return (
                    <article
                      key={holiday.id}
                      className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-stone-50"
                    >
                      <button
                        type="button"
                        onClick={() => void handleToggleHoliday(holiday.id)}
                        className="flex w-full flex-col gap-5 px-5 py-5 text-left transition hover:bg-stone-100"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-2xl font-semibold tracking-tight text-stone-950">
                                {holiday.name}
                              </h3>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                                  isActiveHoliday(holiday)
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-stone-200 text-stone-600"
                                }`}
                              >
                                {isActiveHoliday(holiday)
                                  ? "Active"
                                  : holiday.isActive
                                    ? "Past"
                                    : "Inactive"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-stone-700">
                              {holiday.destination}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              Assigned to {formatMonthLabel(holiday.assignedMonth)}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              {formatDisplayDate(holiday.startDate)} to{" "}
                              {formatDisplayDate(holiday.endDate)}
                            </p>
                            {holiday.description ? (
                              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                                {holiday.description}
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-[1.5rem] bg-white px-5 py-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                              Total cost
                            </p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                              {formatCurrency(totalCost)}
                            </p>
                            <p className="mt-2 text-sm text-stone-500">
                              {holiday.expenseCount}{" "}
                              {holiday.expenseCount === 1 ? "expense" : "expenses"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex h-4 overflow-hidden rounded-full bg-stone-200">
                            {holidayExpenseTypeOptions.map((option) => {
                              const amount =
                                Number(
                                  holiday.expenseBreakdown.find(
                                    (entry) => entry.expenseType === option.value,
                                  )?.totalCost ?? 0,
                                ) || 0;
                              const width = totalCost > 0 ? (amount / totalCost) * 100 : 0;

                              return width > 0 ? (
                                <div
                                  key={option.value}
                                  className={option.colorClass}
                                  style={{ width: `${width}%` }}
                                />
                              ) : null;
                            })}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-stone-600">
                            {holidayExpenseTypeOptions.map((option) => {
                              const amount =
                                holiday.expenseBreakdown.find(
                                  (entry) => entry.expenseType === option.value,
                                )?.totalCost ?? "0";

                              return (
                                <div key={option.value} className="flex items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${option.colorClass}`}
                                  />
                                  <span>
                                    {option.label}: {formatCurrency(amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-stone-200 bg-white px-5 py-5">
                          {expenseErrors[holiday.id] ? (
                            <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {expenseErrors[holiday.id]}
                            </p>
                          ) : null}

                          {expandedLoadingId === holiday.id && !detail ? (
                            <p className="text-sm text-stone-500">Loading holiday details...</p>
                          ) : detail ? (
                            <div className="flex flex-col gap-6">
                              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4">
                                <div className="flex flex-col gap-4">
                                  <div>
                                    <h4 className="text-lg font-semibold text-stone-950">
                                      Holiday details
                                    </h4>
                                    <p className="mt-1 text-sm text-stone-500">
                                      Update the trip name and travel dates without
                                      recreating the holiday.
                                    </p>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <label className="flex flex-col gap-2 xl:col-span-2">
                                      <span className="text-sm font-medium text-stone-700">
                                        Name
                                      </span>
                                      <input
                                        type="text"
                                        value={holidayDraft.name}
                                        onChange={(event) =>
                                          handleHolidayDraftChange(
                                            holiday.id,
                                            "name",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                        disabled={savingHolidayId === holiday.id}
                                      />
                                    </label>

                                    <label className="flex flex-col gap-2">
                                      <span className="text-sm font-medium text-stone-700">
                                        Start date
                                      </span>
                                      <input
                                        type="date"
                                        autoComplete="off"
                                        value={holidayDraft.startDate}
                                        onChange={(event) =>
                                          handleHolidayDraftChange(
                                            holiday.id,
                                            "startDate",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                        disabled={savingHolidayId === holiday.id}
                                      />
                                    </label>

                                    <label className="flex flex-col gap-2">
                                      <span className="text-sm font-medium text-stone-700">
                                        End date
                                      </span>
                                      <input
                                        type="date"
                                        autoComplete="off"
                                        value={holidayDraft.endDate}
                                        onChange={(event) =>
                                          handleHolidayDraftChange(
                                            holiday.id,
                                            "endDate",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                        disabled={savingHolidayId === holiday.id}
                                      />
                                    </label>

                                    <div className="flex items-end xl:col-start-4">
                                      <button
                                        type="button"
                                        onClick={() => void handleSaveHoliday(holiday.id)}
                                        className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                                        disabled={savingHolidayId === holiday.id}
                                      >
                                        {savingHolidayId === holiday.id
                                          ? "Saving..."
                                          : "Save holiday"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                {holidayErrors[holiday.id] ? (
                                  <p className="mt-3 text-sm text-red-600">
                                    {holidayErrors[holiday.id]}
                                  </p>
                                ) : (
                                  <p className="mt-3 text-sm text-stone-500">
                                    Destination stays as {detail.destination}.
                                  </p>
                                )}
                              </div>

                              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                                  <div className="flex flex-1 flex-col gap-2">
                                    <label
                                      htmlFor={`assignment-month-${holiday.id}`}
                                      className="text-sm font-medium text-stone-700"
                                    >
                                      Assigned month
                                    </label>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAssignmentDraftChange(
                                            holiday.id,
                                            shiftMonthValue(assignmentDraft.assignedMonth, -1),
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                                        disabled={savingAssignmentId === holiday.id}
                                      >
                                        Previous
                                      </button>
                                      <input
                                        id={`assignment-month-${holiday.id}`}
                                        type="month"
                                        autoComplete="off"
                                        value={assignmentDraft.assignedMonth}
                                        onChange={(event) =>
                                          handleAssignmentDraftChange(
                                            holiday.id,
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                        disabled={savingAssignmentId === holiday.id}
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAssignmentDraftChange(
                                            holiday.id,
                                            shiftMonthValue(assignmentDraft.assignedMonth, 1),
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
                                        disabled={savingAssignmentId === holiday.id}
                                      >
                                        Next
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveAssignment(holiday.id)}
                                    className="h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                                    disabled={savingAssignmentId === holiday.id}
                                  >
                                    {savingAssignmentId === holiday.id
                                      ? "Saving..."
                                      : "Save assigned month"}
                                  </button>
                                </div>
                                {assignmentErrors[holiday.id] ? (
                                  <p className="mt-3 text-sm text-red-600">
                                    {assignmentErrors[holiday.id]}
                                  </p>
                                ) : (
                                  <p className="mt-3 text-sm text-stone-500">
                                    Change this if the holiday should count toward a different
                                    month dashboard summary.
                                  </p>
                                )}
                              </div>

                              <div className="overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-0">
                                  <thead>
                                    <tr className="text-left text-sm text-stone-500">
                                      <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                                        Date
                                      </th>
                                      <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                                        Type
                                      </th>
                                      <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                                        Description
                                      </th>
                                      <th className="border-b border-stone-200 pb-3 pr-4 font-medium">
                                        Notes
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
                                    {detail.holidayExpenses.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={6}
                                          className="py-8 text-center text-sm text-stone-500"
                                        >
                                          No expenses logged for this holiday yet.
                                        </td>
                                      </tr>
                                    ) : (
                                      detail.holidayExpenses.map((expense) => (
                                        <tr key={expense.id} className="text-sm text-stone-700">
                                          <td className="border-b border-stone-100 py-4 pr-4 whitespace-nowrap">
                                            {formatDisplayDate(expense.expenseDate)}
                                          </td>
                                          <td className="border-b border-stone-100 py-4 pr-4 whitespace-nowrap">
                                            {holidayExpenseTypeOptions.find(
                                              (option) => option.value === expense.expenseType,
                                            )?.label ?? expense.expenseType}
                                          </td>
                                          <td className="border-b border-stone-100 py-4 pr-4">
                                            {expense.description}
                                          </td>
                                          <td className="border-b border-stone-100 py-4 pr-4">
                                            {expense.notes || "—"}
                                          </td>
                                          <td className="border-b border-stone-100 py-4 pr-4 text-right font-medium whitespace-nowrap text-stone-950">
                                            {formatCurrency(expense.amount)}
                                          </td>
                                          <td className="border-b border-stone-100 py-4 text-right">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void handleDeleteExpense(holiday.id, expense.id)
                                              }
                                              disabled={deletingExpenseId === expense.id}
                                              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                                            >
                                              {deletingExpenseId === expense.id
                                                ? "Deleting..."
                                                : "Delete"}
                                            </button>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                                <div className="flex flex-col gap-4">
                                  <div>
                                    <h4 className="text-lg font-semibold text-stone-950">
                                      Add expense
                                    </h4>
                                    <p className="mt-1 text-sm text-stone-500">
                                      Log travel costs directly against this holiday.
                                    </p>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                    <label className="flex flex-col gap-2">
                                      <span className="text-sm font-medium text-stone-700">
                                        Type
                                      </span>
                                      <select
                                        value={draft.expenseType}
                                        onChange={(event) =>
                                          handleExpenseDraftChange(
                                            holiday.id,
                                            "expenseType",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                      >
                                        {holidayExpenseTypeOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="flex flex-col gap-2 xl:col-span-2">
                                      <span className="text-sm font-medium text-stone-700">
                                        Description
                                      </span>
                                      <input
                                        type="text"
                                        value={draft.description}
                                        onChange={(event) =>
                                          handleExpenseDraftChange(
                                            holiday.id,
                                            "description",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                      />
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
                                        value={draft.amount}
                                        onChange={(event) =>
                                          handleExpenseDraftChange(
                                            holiday.id,
                                            "amount",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                      />
                                    </label>

                                    <label className="flex flex-col gap-2">
                                      <span className="text-sm font-medium text-stone-700">
                                        Date
                                      </span>
                                      <input
                                        type="date"
                                        autoComplete="off"
                                        value={draft.expenseDate}
                                        onChange={(event) =>
                                          handleExpenseDraftChange(
                                            holiday.id,
                                            "expenseDate",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                      />
                                    </label>

                                    <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-4">
                                      <span className="text-sm font-medium text-stone-700">
                                        Notes
                                      </span>
                                      <input
                                        type="text"
                                        value={draft.notes}
                                        onChange={(event) =>
                                          handleExpenseDraftChange(
                                            holiday.id,
                                            "notes",
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                                        placeholder="Optional"
                                      />
                                    </label>

                                    <div className="flex items-end">
                                      <button
                                        type="button"
                                        onClick={() => void handleAddExpense(holiday.id)}
                                        disabled={submittingExpenseId === holiday.id}
                                        className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                                      >
                                        {submittingExpenseId === holiday.id
                                          ? "Saving..."
                                          : "Add expense"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
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
