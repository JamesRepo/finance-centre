import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { shiftMonthValue } from "@/lib/months";
import type { BudgetPlanCadence, BudgetPlanStream } from "@/lib/validators";

type SeedItem = {
  stream: BudgetPlanStream;
  sourceId: string | null;
  label: string;
  amount: Prisma.Decimal | number;
  cadence: BudgetPlanCadence;
  colorCode: string | null;
  sortOrder: number;
  isCustom: boolean;
  enabled: boolean;
};

type PlanWithItems = {
  id: number;
  name: string;
  startMonth: Date;
  endMonth: Date;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    planId: number;
    stream: string;
    sourceId: string | null;
    label: string;
    amount: Prisma.Decimal;
    cadence: string;
    colorCode: string | null;
    sortOrder: number;
    isCustom: boolean;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

const streamLabels: Record<BudgetPlanStream, string> = {
  SPENDING: "Spending",
  CATEGORY: "Spending",
  HOUSING: "Housing",
  SUBSCRIPTION: "Subscriptions",
  HOLIDAY: "Holidays",
  DEBT: "Debt payments",
  SAVINGS: "Savings",
  INCOME: "Income",
};

function toDecimal(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function monthlyEquivalentDecimal(
  amount: Prisma.Decimal | number | string | null | undefined,
  frequency: string | null | undefined,
) {
  const value = toDecimal(amount);

  if (frequency === "YEARLY" || frequency === "ANNUALLY") {
    return value.div(new Prisma.Decimal(12));
  }

  if (frequency === "WEEKLY") {
    return value.mul(new Prisma.Decimal(52)).div(new Prisma.Decimal(12));
  }

  return value;
}

export function getMonthStart(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

export function formatMonthValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}`;
}

export function generatePlanMonths(startMonth: string, endMonth: string) {
  const months: string[] = [];
  let current = startMonth;

  while (current <= endMonth) {
    months.push(current);
    current = shiftMonthValue(current, 1);
  }

  return months;
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function calculateMonthlyEquivalent(amount: Prisma.Decimal, cadence: string) {
  const value = decimalToNumber(amount);

  return cadence === "YEARLY" ? value / 12 : value;
}

function getStreamBucket(stream: string) {
  if (stream === "INCOME") return "income";
  if (stream === "DEBT") return "debtPayments";
  if (stream === "SAVINGS") return "savings";
  return "spending";
}

export function serializeBudgetPlan(plan: PlanWithItems) {
  const startMonth = formatMonthValue(plan.startMonth);
  const endMonth = formatMonthValue(plan.endMonth);
  const months = generatePlanMonths(startMonth, endMonth);
  const monthCount = months.length;

  const items = plan.items.map((item) => {
    const monthlyEquivalent = calculateMonthlyEquivalent(item.amount, item.cadence);

    return {
      id: item.id,
      planId: item.planId,
      stream: item.stream,
      streamLabel:
        streamLabels[item.stream as BudgetPlanStream] ?? item.stream,
      sourceId: item.sourceId,
      label: item.label,
      amount: item.amount.toString(),
      cadence: item.cadence,
      colorCode: item.colorCode,
      sortOrder: item.sortOrder,
      isCustom: item.isCustom,
      enabled: item.enabled,
      monthlyEquivalent,
      periodTotal: monthlyEquivalent * monthCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  const enabledItems = items.filter((item) => item.enabled);
  const monthlyCashflow = months.map((month) => {
    const totals = {
      income: 0,
      spending: 0,
      debtPayments: 0,
      savings: 0,
    };

    for (const item of enabledItems) {
      totals[getStreamBucket(item.stream)] += item.monthlyEquivalent;
    }

    const outgoings = totals.spending + totals.debtPayments + totals.savings;

    return {
      month,
      income: totals.income,
      spending: totals.spending,
      debtPayments: totals.debtPayments,
      savings: totals.savings,
      outgoings,
      netPosition: totals.income - outgoings,
    };
  });

  const summary = monthlyCashflow.reduce(
    (totals, month) => ({
      income: totals.income + month.income,
      spending: totals.spending + month.spending,
      debtPayments: totals.debtPayments + month.debtPayments,
      savings: totals.savings + month.savings,
      outgoings: totals.outgoings + month.outgoings,
      netPosition: totals.netPosition + month.netPosition,
    }),
    {
      income: 0,
      spending: 0,
      debtPayments: 0,
      savings: 0,
      outgoings: 0,
      netPosition: 0,
    },
  );

  return {
    id: plan.id,
    name: plan.name,
    startMonth,
    endMonth,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    items,
    monthlyCashflow,
    summary: {
      ...summary,
      averageMonthlyNet: monthCount > 0 ? summary.netPosition / monthCount : 0,
    },
  };
}

export async function getBudgetPlan(planId: number) {
  return prisma.budgetPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        orderBy: [{ stream: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      },
    },
  });
}

export async function buildSeedItems(startMonth: string): Promise<SeedItem[]> {
  const startRange = getMonthRange(startMonth);
  const previousMonth = shiftMonthValue(startMonth, -1);
  const previousRange = getMonthRange(previousMonth);

  const [
    categories,
    currentHousing,
    previousHousing,
    subscriptions,
    holidays,
    debts,
    incomeSources,
  ] = await Promise.all([
    prisma.category.findMany({
      include: {
        budgets: {
          where: { month: startRange },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.housingExpense.findMany({
      where: { expenseMonth: startRange },
      orderBy: { expenseType: "asc" },
    }),
    prisma.housingExpense.findMany({
      where: { expenseMonth: previousRange },
      orderBy: { expenseType: "asc" },
    }),
    prisma.subscription.findMany({
      where: { paymentMonth: startRange },
      orderBy: [{ paymentDate: "asc" }, { name: "asc" }],
    }),
    prisma.holiday.findMany({
      where: { isActive: true },
      include: {
        holidayExpenses: {
          select: { amount: true },
        },
      },
      orderBy: [{ assignedMonth: "asc" }, { startDate: "asc" }],
    }),
    prisma.debt.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.incomeSource.findMany({
      where: {
        isActive: true,
        isRecurring: true,
        NOT: { recurrenceFrequency: "ONE_OFF" },
      },
      orderBy: [{ incomeDate: "asc" }, { incomeType: "asc" }],
    }),
  ]);

  const housingByType = new Map(
    previousHousing.map((expense) => [expense.expenseType, expense]),
  );
  for (const expense of currentHousing) {
    housingByType.set(expense.expenseType, expense);
  }

  const housingTotal = [...housingByType.values()].reduce(
    (sum, expense) =>
      sum.plus(monthlyEquivalentDecimal(expense.amount, expense.frequency)),
    new Prisma.Decimal(0),
  );
  const subscriptionTotal = subscriptions.reduce(
    (sum, subscription) =>
      sum.plus(monthlyEquivalentDecimal(subscription.amount, subscription.frequency)),
    new Prisma.Decimal(0),
  );
  const holidayTotal = holidays.reduce(
    (holidaySum, holiday) =>
      holidaySum.plus(
        holiday.holidayExpenses.reduce(
          (expenseSum, expense) => expenseSum.plus(expense.amount),
          new Prisma.Decimal(0),
        ),
      ),
    new Prisma.Decimal(0),
  );
  const debtTotal = debts.reduce(
    (sum, debt) => sum.plus(debt.minimumPayment ?? 0),
    new Prisma.Decimal(0),
  );
  const incomeTotal = incomeSources.reduce(
    (sum, incomeSource) =>
      incomeSource.recurrenceFrequency === "ONE_OFF"
        ? sum
        : sum.plus(
            monthlyEquivalentDecimal(
              incomeSource.netAmount,
              incomeSource.recurrenceFrequency,
            ),
          ),
    new Prisma.Decimal(0),
  );

  return [
    {
      stream: "INCOME",
      sourceId: null,
      label: "Income",
      amount: incomeTotal,
      cadence: "MONTHLY",
      colorCode: null,
      sortOrder: 0,
      isCustom: false,
      enabled: true,
    },
    ...categories.map((category, index) => ({
      stream: "CATEGORY" as const,
      sourceId: category.id,
      label: category.name,
      amount: category.budgets[0]?.amount ?? 0,
      cadence: "MONTHLY" as const,
      colorCode: category.colorCode,
      sortOrder: 100 + index,
      isCustom: false,
      enabled: true,
    })),
    {
      stream: "HOUSING",
      sourceId: null,
      label: "Housing",
      amount: housingTotal,
      cadence: "MONTHLY",
      colorCode: null,
      sortOrder: 2000,
      isCustom: false,
      enabled: true,
    },
    {
      stream: "SUBSCRIPTION",
      sourceId: null,
      label: "Subscriptions",
      amount: subscriptionTotal,
      cadence: "MONTHLY",
      colorCode: null,
      sortOrder: 3000,
      isCustom: false,
      enabled: true,
    },
    {
      stream: "HOLIDAY",
      sourceId: null,
      label: "Holidays",
      amount: holidayTotal,
      cadence: "YEARLY",
      colorCode: null,
      sortOrder: 4000,
      isCustom: false,
      enabled: true,
    },
    {
      stream: "DEBT",
      sourceId: null,
      label: "Debts",
      amount: debtTotal,
      cadence: "MONTHLY",
      colorCode: null,
      sortOrder: 5000,
      isCustom: false,
      enabled: true,
    },
    {
      stream: "SAVINGS",
      sourceId: null,
      label: "Savings",
      amount: 0,
      cadence: "MONTHLY",
      colorCode: null,
      sortOrder: 6000,
      isCustom: false,
      enabled: true,
    },
  ];
}

export async function getNextSortOrder(planId: number, stream: BudgetPlanStream) {
  const lastItem = await prisma.budgetPlanItem.findFirst({
    where: { planId, stream },
    orderBy: { sortOrder: "desc" },
  });

  return (lastItem?.sortOrder ?? 0) + 1;
}
