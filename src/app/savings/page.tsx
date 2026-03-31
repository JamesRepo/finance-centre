"use client";

import { differenceInMonths } from "date-fns";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const today = new Date();
const defaultDate = format(today, "yyyy-MM-dd");

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

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

type Priority = (typeof priorityOptions)[number]["value"];

const priorityBadgeStyles: Record<Priority, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },
  z.string().trim().optional(),
);

const goalFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a goal name"),
  targetAmount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Target amount must be greater than 0"),
  ),
  targetDate: optionalTrimmedString,
  priority: z.enum(["LOW", "MEDIUM", "HIGH"], {
    message: "Select a priority",
  }),
});

const contributionFormSchema = z.object({
  amount: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive("Contribution amount must be greater than 0"),
  ),
  contributionDate: z.string().min(1, "Enter a date"),
  note: optionalTrimmedString,
});

type SavingsContribution = {
  id: number;
  goalId: number;
  amount: string;
  contributionDate: string;
  note: string | null;
  createdAt: string;
};

type SavingsGoal = {
  id: number;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  priority: Priority | null;
  createdAt: string;
  savingsContributions: SavingsContribution[];
  currentAmount: string;
  progress: string;
};

type GoalFormValues = z.input<typeof goalFormSchema>;
type GoalFormSubmitValues = z.output<typeof goalFormSchema>;
type ContributionFormValues = z.input<typeof contributionFormSchema>;
type ContributionFormSubmitValues = z.output<typeof contributionFormSchema>;

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

function sortContributions(contributions: SavingsContribution[]) {
  return [...contributions].sort(
    (left, right) =>
      new Date(right.contributionDate).getTime() -
      new Date(left.contributionDate).getTime(),
  );
}

function getMonthsRemaining(targetDate: string | null) {
  if (!targetDate) {
    return null;
  }

  const months = differenceInMonths(new Date(targetDate), today);

  if (months <= 0) {
    return 0;
  }

  return months;
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

function GoalCard({
  goal,
  expanded,
  deletingContributionId,
  onToggleContributionForm,
  onAddContribution,
  onDeleteContribution,
}: {
  goal: SavingsGoal;
  expanded: boolean;
  deletingContributionId: number | null;
  onToggleContributionForm: (goalId: number) => void;
  onAddContribution: (
    goalId: number,
    values: ContributionFormSubmitValues,
  ) => Promise<string | null>;
  onDeleteContribution: (
    goalId: number,
    contributionId: number,
  ) => Promise<string | null>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContributionFormValues, undefined, ContributionFormSubmitValues>({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: {
      amount: undefined,
      contributionDate: defaultDate,
      note: "",
    },
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const targetAmount = Number(goal.targetAmount);
  const currentAmount = Number(goal.currentAmount);
  const remaining = Math.max(targetAmount - currentAmount, 0);
  const progressRatio =
    targetAmount > 0 ? Math.min(currentAmount / targetAmount, 1) : 0;
  const monthsRemaining = getMonthsRemaining(goal.targetDate);
  const recentContributions = useMemo(
    () => sortContributions(goal.savingsContributions).slice(0, 5),
    [goal.savingsContributions],
  );

  async function submitContribution(values: ContributionFormSubmitValues) {
    setSubmitError(null);

    const error = await onAddContribution(goal.id, values);

    if (error) {
      setSubmitError(error);
      return;
    }

    reset({
      amount: undefined,
      contributionDate: defaultDate,
      note: "",
    });
  }

  return (
    <article className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
                {goal.name}
              </h2>
              {goal.priority ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase ${priorityBadgeStyles[goal.priority]}`}
                >
                  {goal.priority}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {goal.targetDate ? (
                <p>
                  <span className="font-medium">Target date:</span>{" "}
                  {formatDisplayDate(goal.targetDate)}
                </p>
              ) : null}
              {monthsRemaining !== null ? (
                <p>
                  <span className="font-medium">Months remaining:</span>{" "}
                  {monthsRemaining === 0 ? "Past due" : monthsRemaining}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-stone-950 px-5 py-4 text-right text-white">
            <p className="text-sm font-medium">Remaining</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
          <div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-stone-600">
                Saved {formatCurrency(currentAmount)} of{" "}
                {formatCurrency(targetAmount)}
              </p>
              <p className="font-medium text-stone-950">
                {formatPercent(progressRatio * 100)}
              </p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progressRatio * 100}%` }}
              />
            </div>
          </div>

          <div className="flex justify-start lg:justify-end">
            <button
              type="button"
              onClick={() => onToggleContributionForm(goal.id)}
              className="h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              {expanded ? "Hide contribution form" : "Add contribution"}
            </button>
          </div>
        </div>

        {expanded ? (
          <form
            className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 md:grid-cols-3"
            onSubmit={handleSubmit(submitContribution)}
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
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("contributionDate")}
              />
              {errors.contributionDate ? (
                <p className="text-sm text-red-600">
                  {errors.contributionDate.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Note</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="Optional"
                {...register("note")}
              />
            </label>

            <div className="flex items-end md:col-span-3">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save contribution"}
              </button>
            </div>

            {submitError ? (
              <p className="text-sm text-red-600 md:col-span-3">
                {submitError}
              </p>
            ) : null}
          </form>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-stone-950">
              Recent contributions
            </h3>
            <p className="text-sm text-stone-500">Last 5</p>
          </div>

          {recentContributions.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-stone-300 px-4 py-4 text-sm">
              No contributions recorded yet.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-stone-200 rounded-[1.5rem] border border-stone-200 bg-white">
              {recentContributions.map((contribution) => (
                <div
                  key={contribution.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-950">
                      {formatDisplayDate(contribution.contributionDate)}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      {contribution.note || "No note"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 sm:justify-end">
                    <p className="text-lg font-semibold text-stone-950">
                      {formatCurrency(Number(contribution.amount))}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void onDeleteContribution(goal.id, contribution.id)
                      }
                      disabled={deletingContributionId === contribution.id}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                    >
                      {deletingContributionId === contribution.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<number | null>(null);
  const [deletingContributionId, setDeletingContributionId] = useState<
    number | null
  >(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues, undefined, GoalFormSubmitValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: "",
      targetAmount: undefined,
      targetDate: "",
      priority: "MEDIUM",
    },
  });

  async function loadGoals() {
    setLoading(true);
    setPageError(null);

    try {
      const response = await fetch("/api/savings", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to load savings goals"),
        );
      }

      const data = (await response.json()) as SavingsGoal[];
      setGoals(data);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to load savings goals",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGoals();
  }, []);

  const summary = useMemo(() => {
    const totalSaved = goals.reduce(
      (sum, goal) => sum + Number(goal.currentAmount),
      0,
    );
    const totalTarget = goals.reduce(
      (sum, goal) => sum + Number(goal.targetAmount),
      0,
    );
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return {
      totalSaved,
      activeCount: goals.length,
      overallProgress,
    };
  }, [goals]);

  async function onSubmit(values: GoalFormSubmitValues) {
    setSubmitError(null);

    try {
      const response = await fetch("/api/savings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: values.name.trim(),
          targetAmount: values.targetAmount,
          targetDate: values.targetDate || undefined,
          priority: values.priority,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to create savings goal"),
        );
      }

      reset({
        name: "",
        targetAmount: undefined,
        targetDate: "",
        priority: "MEDIUM",
      });
      await loadGoals();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to create savings goal",
      );
    }
  }

  async function handleAddContribution(
    goalId: number,
    values: ContributionFormSubmitValues,
  ) {
    try {
      const response = await fetch(`/api/savings/${goalId}/contributions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: values.amount,
          contributionDate: values.contributionDate,
          note: values.note?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to add contribution"),
        );
      }

      await loadGoals();
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Failed to add contribution";
    }
  }

  async function handleDeleteContribution(
    goalId: number,
    contributionId: number,
  ) {
    setDeletingContributionId(contributionId);
    setPageError(null);

    try {
      const response = await fetch(
        `/api/savings/${goalId}/contributions/${contributionId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Failed to delete contribution"),
        );
      }

      await loadGoals();
      return null;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete contribution";
      setPageError(message);
      return message;
    } finally {
      setDeletingContributionId(null);
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
                  Savings
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                  Savings goals
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  Set targets, track contributions, and watch your savings grow.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label="Total saved"
                  value={formatCurrency(summary.totalSaved)}
                  tone="dark"
                />
                <SummaryCard
                  label="Active goals"
                  value={String(summary.activeCount)}
                  tone="light"
                />
                <SummaryCard
                  label="Overall progress"
                  value={formatPercent(summary.overallProgress)}
                  tone="light"
                />
              </div>
            </div>
          </div>

          <form
            className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={handleSubmit(onSubmit)}
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Name</span>
              <input
                type="text"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="e.g. Emergency fund"
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Target amount
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                placeholder="0.00"
                {...register("targetAmount")}
              />
              {errors.targetAmount ? (
                <p className="text-sm text-red-600">
                  {errors.targetAmount.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Target date
              </span>
              <input
                type="date"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("targetDate")}
              />
              {errors.targetDate ? (
                <p className="text-sm text-red-600">
                  {errors.targetDate.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Priority
              </span>
              <select
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
                disabled={isSubmitting}
                {...register("priority")}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.priority ? (
                <p className="text-sm text-red-600">
                  {errors.priority.message}
                </p>
              ) : null}
            </label>

            <div className="flex items-end md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Add goal"}
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
          <div className="border-b border-stone-200 px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              Portfolio
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              Your goals
            </h2>
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
                Loading savings goals...
              </div>
            ) : goals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                No savings goals have been added yet.
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {goals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    expanded={expandedGoalId === goal.id}
                    deletingContributionId={deletingContributionId}
                    onToggleContributionForm={(goalId) =>
                      setExpandedGoalId((currentId) =>
                        currentId === goalId ? null : goalId,
                      )
                    }
                    onAddContribution={handleAddContribution}
                    onDeleteContribution={handleDeleteContribution}
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
