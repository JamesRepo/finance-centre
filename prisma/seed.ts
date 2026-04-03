import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(
  pool as unknown as ConstructorParameters<typeof PrismaPg>[0],
);
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Groceries", colorCode: "#22c55e", showOnDashboardDailySpending: true },
  { name: "Eating Out", colorCode: "#f59e0b", showOnDashboardDailySpending: true },
  { name: "Transport", colorCode: "#3b82f6", showOnDashboardDailySpending: true },
  { name: "Fun / Exercise", colorCode: "#a855f7", showOnDashboardDailySpending: false },
  { name: "Shopping", colorCode: "#ec4899", showOnDashboardDailySpending: true },
  { name: "Personal Care", colorCode: "#14b8a6", showOnDashboardDailySpending: true },
  { name: "Pub / Going Out", colorCode: "#64748b", showOnDashboardDailySpending: false },
  { name: "Clothes", colorCode: "#f97316", showOnDashboardDailySpending: false },
  {
    name: "Personal Development / Tech",
    colorCode: "#6366f1",
    showOnDashboardDailySpending: false,
  },
];

const monthlyBudgets = {
  current: {
    "Groceries": 420,
    "Eating Out": 180,
    "Transport": 120,
    "Fun / Exercise": 90,
    "Shopping": 160,
    "Personal Care": 75,
    "Pub / Going Out": 140,
    "Clothes": 110,
    "Personal Development / Tech": 95,
  },
  previous: {
    "Groceries": 380,
    "Eating Out": 150,
    "Transport": 110,
    "Fun / Exercise": 80,
    "Shopping": 130,
    "Personal Care": 60,
    "Pub / Going Out": 120,
    "Clothes": 90,
    "Personal Development / Tech": 85,
  },
} as const;

const sampleTransactions = [
  {
    categoryName: "Groceries",
    daysAgo: 2,
    description: "[Seed] Weekly food shop",
    vendor: "Tesco",
    lineItems: [{ amount: 52.3 }, { amount: 16.15 }],
  },
  {
    categoryName: "Eating Out",
    daysAgo: 4,
    description: "[Seed] Dinner with friends",
    vendor: "Dishoom",
    lineItems: [{ amount: 24.8 }],
  },
  {
    categoryName: "Transport",
    daysAgo: 6,
    description: "[Seed] Train tickets",
    vendor: "National Rail",
    lineItems: [{ amount: 11.6 }, { amount: 4.6 }],
  },
  {
    categoryName: "Shopping",
    daysAgo: 9,
    description: "[Seed] Home bits",
    vendor: "Amazon",
    lineItems: [{ amount: 34.99 }, { amount: 18 }],
  },
  {
    categoryName: "Personal Development / Tech",
    daysAgo: 11,
    description: "[Seed] App subscription",
    vendor: "OpenAI",
    lineItems: [{ amount: 19 }],
  },
  {
    categoryName: "Groceries",
    daysAgo: 34,
    description: "[Seed] Last month food shop",
    vendor: "Sainsbury's",
    lineItems: [{ amount: 61.4 }, { amount: 12.75 }],
  },
  {
    categoryName: "Pub / Going Out",
    daysAgo: 38,
    description: "[Seed] Friday drinks",
    vendor: "Local Pub",
    lineItems: [{ amount: 19.5 }, { amount: 12 }],
  },
  {
    categoryName: "Clothes",
    daysAgo: 42,
    description: "[Seed] Basics refresh",
    vendor: "Uniqlo",
    lineItems: [{ amount: 45 }],
  },
] as const;

const sampleDebts = [
  {
    name: "[Seed] Travel Rewards Card",
    debtType: "CREDIT_CARD",
    originalBalance: 2400,
    interestRate: 24.9,
    minimumPayment: 90,
    startMonthOffset: -8,
    targetPayoffMonthOffset: 6,
    isActive: true,
    notes: "[Seed] Used for trip spending and paid down monthly.",
    payments: [
      { amount: 180, interestAmount: 28, monthOffset: -1, day: 12, note: "[Seed] Last month payment" },
      { amount: 210, interestAmount: 24, monthOffset: 0, day: 10, note: "[Seed] Current month payment" },
    ],
  },
  {
    name: "[Seed] Postgrad Loan",
    debtType: "STUDENT_LOAN",
    originalBalance: 12800,
    interestRate: 6.5,
    minimumPayment: 120,
    startMonthOffset: -18,
    targetPayoffMonthOffset: 48,
    isActive: true,
    notes: "[Seed] Salary-linked deductions plus occasional manual overpayments.",
    payments: [
      { amount: 120, interestAmount: 0, monthOffset: 0, day: 28, note: "[Seed] Payroll deduction" },
      { amount: 120, interestAmount: 0, monthOffset: -1, day: 28, note: "[Seed] Previous payroll deduction" },
    ],
  },
] as const;

const sampleSavingsGoals = [
  {
    name: "[Seed] Emergency Buffer",
    targetAmount: 6000,
    targetMonthOffset: 10,
    priority: "HIGH",
    contributions: [
      { amount: 500, monthOffset: -2, day: 2, note: "[Seed] Initial top-up" },
      { amount: 350, monthOffset: -1, day: 2, note: "[Seed] Last month transfer" },
      { amount: 350, monthOffset: 0, day: 2, note: "[Seed] This month transfer" },
    ],
  },
  {
    name: "[Seed] Summer Trip Fund",
    targetAmount: 2200,
    targetMonthOffset: 4,
    priority: "MEDIUM",
    contributions: [
      { amount: 150, monthOffset: -1, day: 8, note: "[Seed] Monthly holiday saving" },
      { amount: 200, monthOffset: 0, day: 8, note: "[Seed] Extra allocation" },
    ],
  },
] as const;

const sampleHousingExpenses = [
  { expenseType: "RENT", amount: 975, frequency: "MONTHLY", monthOffset: 0 },
  { expenseType: "COUNCIL_TAX", amount: 165, frequency: "MONTHLY", monthOffset: 0 },
  { expenseType: "ENERGY", amount: 118, frequency: "MONTHLY", monthOffset: 0 },
  { expenseType: "INTERNET", amount: 32, frequency: "MONTHLY", monthOffset: 0 },
  { expenseType: "RENT", amount: 975, frequency: "MONTHLY", monthOffset: -1 },
] as const;

const sampleSubscriptions = [
  {
    name: "[Seed] Netflix",
    amount: 15.99,
    frequency: "MONTHLY",
    monthOffset: 0,
    paymentDay: 3,
    description: "[Seed] Streaming subscription",
  },
  {
    name: "[Seed] Gym",
    amount: 360,
    frequency: "YEARLY",
    monthOffset: 0,
    paymentDay: 6,
    description: "[Seed] Annual membership billed this month",
  },
  {
    name: "[Seed] Apple Music",
    amount: 10.99,
    frequency: "MONTHLY",
    monthOffset: -1,
    paymentDay: 14,
    description: "[Seed] Previous month recurring entertainment",
  },
] as const;

const sampleIncomeSources = [
  {
    incomeType: "SALARY",
    description: "[Seed] Main salary",
    grossAmount: 4200,
    netAmount: 3180,
    monthOffset: 0,
    day: 28,
    isRecurring: true,
    recurrenceFrequency: "MONTHLY",
    isActive: true,
    deductions: [
      {
        deductionType: "INCOME_TAX",
        name: "[Seed] PAYE tax",
        amount: 620,
        isPercentage: false,
      },
      {
        deductionType: "NI",
        name: "[Seed] National Insurance",
        amount: 260,
        isPercentage: false,
      },
      {
        deductionType: "PENSION",
        name: "[Seed] Workplace pension",
        amount: 140,
        isPercentage: false,
      },
    ],
  },
  {
    incomeType: "FREELANCE",
    description: "[Seed] Side project invoice",
    grossAmount: 650,
    netAmount: 650,
    monthOffset: 0,
    day: 16,
    isRecurring: false,
    recurrenceFrequency: "ONE_OFF",
    isActive: true,
    deductions: [],
  },
  {
    incomeType: "BONUS",
    description: "[Seed] Quarterly bonus",
    grossAmount: 1200,
    netAmount: 840,
    monthOffset: -1,
    day: 25,
    isRecurring: false,
    recurrenceFrequency: "ONE_OFF",
    isActive: true,
    deductions: [
      {
        deductionType: "INCOME_TAX",
        name: "[Seed] Bonus tax",
        amount: 300,
        isPercentage: false,
      },
      {
        deductionType: "NI",
        name: "[Seed] Bonus NI",
        amount: 60,
        isPercentage: false,
      },
    ],
  },
] as const;

const seedSettings = {
  currency: "GBP",
  locale: "en-GB",
  monthlyBudgetTotal: 1390,
} as const;

const sampleHolidays = [
  {
    name: "[Seed] Lisbon Long Weekend",
    destination: "Lisbon",
    assignedMonthOffset: 0,
    startDay: 18,
    endDay: 21,
    description: "City break with flights, food, and tram-heavy days.",
    expenses: [
      { expenseType: "FLIGHT", description: "[Seed] Return flights", amount: 180, day: 2 },
      {
        expenseType: "ACCOMMODATION",
        description: "[Seed] Boutique hotel",
        amount: 320,
        day: 5,
      },
      { expenseType: "FOOD", description: "[Seed] Restaurants", amount: 140, day: 19 },
      { expenseType: "TRANSPORT", description: "[Seed] Metro and tram", amount: 38, day: 20 },
    ],
  },
  {
    name: "[Seed] Tokyo Adventure",
    destination: "Tokyo",
    assignedMonthOffset: -1,
    startDay: 7,
    endDay: 16,
    description: "Bigger trip assigned to last month for dashboard visibility.",
    expenses: [
      { expenseType: "FLIGHT", description: "[Seed] Long-haul flights", amount: 940, day: 1 },
      {
        expenseType: "ACCOMMODATION",
        description: "[Seed] Shinjuku hotel",
        amount: 760,
        day: 3,
      },
      { expenseType: "ACTIVITY", description: "[Seed] TeamLab tickets", amount: 55, day: 9 },
      { expenseType: "FOOD", description: "[Seed] Food budget", amount: 220, day: 12 },
      { expenseType: "SHOPPING", description: "[Seed] Souvenirs", amount: 95, day: 14 },
    ],
  },
  {
    name: "[Seed] Cornwall Escape",
    destination: "Cornwall",
    assignedMonthOffset: 1,
    startDay: 12,
    endDay: 17,
    description: "Future domestic trip to show forward month assignment.",
    expenses: [
      { expenseType: "ACCOMMODATION", description: "[Seed] Cottage deposit", amount: 250, day: 1 },
      { expenseType: "TRANSPORT", description: "[Seed] Train booking", amount: 84, day: 2 },
    ],
  },
] as const;

function getMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function subtractMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
}

function subtractDays(date: Date, days: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - days, 12),
  );
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function createUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

function formatMonthValue(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${date.getUTCFullYear()}-${month}`;
}

async function main() {
  const now = new Date();
  const currentMonth = getMonthStart(now);
  const previousMonth = subtractMonths(now, 1);

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {
        colorCode: category.colorCode,
        isSystem: true,
        showOnDashboardDailySpending: category.showOnDashboardDailySpending,
      },
      create: {
        ...category,
        isSystem: true,
      },
    });
  }

  const categoryRecords = await prisma.category.findMany();
  const categoryIdByName = new Map(
    categoryRecords.map((category) => [category.name, category.id]),
  );

  for (const [categoryName, amount] of Object.entries(monthlyBudgets.current)) {
    const categoryId = categoryIdByName.get(categoryName);

    if (!categoryId) {
      throw new Error(`Missing category for current month budget: ${categoryName}`);
    }

    await prisma.budget.upsert({
      where: {
        categoryId_month: {
          categoryId,
          month: currentMonth,
        },
      },
      update: {
        amount,
      },
      create: {
        categoryId,
        month: currentMonth,
        amount,
      },
    });
  }

  for (const [categoryName, amount] of Object.entries(monthlyBudgets.previous)) {
    const categoryId = categoryIdByName.get(categoryName);

    if (!categoryId) {
      throw new Error(`Missing category for previous month budget: ${categoryName}`);
    }

    await prisma.budget.upsert({
      where: {
        categoryId_month: {
          categoryId,
          month: previousMonth,
        },
      },
      update: {
        amount,
      },
      create: {
        categoryId,
        month: previousMonth,
        amount,
      },
    });
  }

  await prisma.transaction.deleteMany({
    where: {
      description: {
        startsWith: "[Seed]",
      },
    },
  });

  await prisma.holiday.deleteMany({
    where: {
      name: {
        startsWith: "[Seed]",
      },
    },
  });

  await prisma.debt.deleteMany({
    where: {
      name: {
        startsWith: "[Seed]",
      },
    },
  });

  await prisma.savingsGoal.deleteMany({
    where: {
      name: {
        startsWith: "[Seed]",
      },
    },
  });

  await prisma.incomeSource.deleteMany({
    where: {
      description: {
        startsWith: "[Seed]",
      },
    },
  });

  await prisma.subscription.deleteMany({
    where: {
      OR: [
        {
          name: {
            startsWith: "[Seed]",
          },
        },
        {
          description: {
            startsWith: "[Seed]",
          },
        },
      ],
    },
  });

  for (const transaction of sampleTransactions) {
    const categoryId = categoryIdByName.get(transaction.categoryName);

    if (!categoryId) {
      throw new Error(`Missing category for sample transaction: ${transaction.categoryName}`);
    }

    await prisma.transaction.create({
      data: {
        categoryId,
        amount: transaction.lineItems.reduce((sum, item) => sum + item.amount, 0),
        transactionDate: subtractDays(now, transaction.daysAgo),
        description: transaction.description,
        vendor: transaction.vendor,
        lineItems: {
          create: transaction.lineItems.map((item, index) => ({
            amount: item.amount,
            sortOrder: index,
          })),
        },
      },
    });
  }

  for (const holiday of sampleHolidays) {
    const assignedMonthDate = addMonths(currentMonth, holiday.assignedMonthOffset);
    const startDate = createUtcDate(
      assignedMonthDate.getUTCFullYear(),
      assignedMonthDate.getUTCMonth(),
      holiday.startDay,
    );
    const endDate = createUtcDate(
      assignedMonthDate.getUTCFullYear(),
      assignedMonthDate.getUTCMonth(),
      holiday.endDay,
    );

    await prisma.holiday.create({
      data: {
        name: holiday.name,
        destination: holiday.destination,
        assignedMonth: formatMonthValue(assignedMonthDate),
        startDate,
        endDate,
        description: holiday.description,
        isActive: true,
        holidayExpenses: {
          create: holiday.expenses.map((expense) => ({
            expenseType: expense.expenseType,
            description: expense.description,
            amount: expense.amount,
            expenseDate: createUtcDate(
              assignedMonthDate.getUTCFullYear(),
              assignedMonthDate.getUTCMonth(),
              expense.day,
            ),
          })),
        },
      },
    });
  }

  for (const debt of sampleDebts) {
    await prisma.debt.create({
      data: {
        name: debt.name,
        debtType: debt.debtType,
        originalBalance: debt.originalBalance,
        interestRate: debt.interestRate,
        minimumPayment: debt.minimumPayment,
        startDate: createUtcDate(
          addMonths(currentMonth, debt.startMonthOffset).getUTCFullYear(),
          addMonths(currentMonth, debt.startMonthOffset).getUTCMonth(),
          1,
        ),
        targetPayoffDate: createUtcDate(
          addMonths(currentMonth, debt.targetPayoffMonthOffset).getUTCFullYear(),
          addMonths(currentMonth, debt.targetPayoffMonthOffset).getUTCMonth(),
          1,
        ),
        isActive: debt.isActive,
        notes: debt.notes,
        debtPayments: {
          create: debt.payments.map((payment) => {
            const paymentMonth = addMonths(currentMonth, payment.monthOffset);
            return {
              amount: payment.amount,
              interestAmount: payment.interestAmount,
              paymentDate: createUtcDate(
                paymentMonth.getUTCFullYear(),
                paymentMonth.getUTCMonth(),
                payment.day,
              ),
              note: payment.note,
            };
          }),
        },
      },
    });
  }

  for (const goal of sampleSavingsGoals) {
    await prisma.savingsGoal.create({
      data: {
        name: goal.name,
        targetAmount: goal.targetAmount,
        targetDate: createUtcDate(
          addMonths(currentMonth, goal.targetMonthOffset).getUTCFullYear(),
          addMonths(currentMonth, goal.targetMonthOffset).getUTCMonth(),
          1,
        ),
        priority: goal.priority,
        savingsContributions: {
          create: goal.contributions.map((contribution) => {
            const contributionMonth = addMonths(currentMonth, contribution.monthOffset);
            return {
              amount: contribution.amount,
              contributionDate: createUtcDate(
                contributionMonth.getUTCFullYear(),
                contributionMonth.getUTCMonth(),
                contribution.day,
              ),
              note: contribution.note,
            };
          }),
        },
      },
    });
  }

  for (const housingExpense of sampleHousingExpenses) {
    const expenseMonth = addMonths(currentMonth, housingExpense.monthOffset);

    await prisma.housingExpense.upsert({
      where: {
        expenseType_expenseMonth: {
          expenseType: housingExpense.expenseType,
          expenseMonth,
        },
      },
      update: {
        amount: housingExpense.amount,
        frequency: housingExpense.frequency,
      },
      create: {
        expenseType: housingExpense.expenseType,
        amount: housingExpense.amount,
        expenseMonth,
        frequency: housingExpense.frequency,
      },
    });
  }

  for (const subscription of sampleSubscriptions) {
    const paymentMonth = addMonths(currentMonth, subscription.monthOffset);

    await prisma.subscription.upsert({
      where: {
        name_paymentMonth: {
          name: subscription.name,
          paymentMonth,
        },
      },
      update: {
        amount: subscription.amount,
        frequency: subscription.frequency,
        paymentDate: createUtcDate(
          paymentMonth.getUTCFullYear(),
          paymentMonth.getUTCMonth(),
          subscription.paymentDay,
        ),
        description: subscription.description,
      },
      create: {
        name: subscription.name,
        amount: subscription.amount,
        frequency: subscription.frequency,
        paymentDate: createUtcDate(
          paymentMonth.getUTCFullYear(),
          paymentMonth.getUTCMonth(),
          subscription.paymentDay,
        ),
        paymentMonth,
        description: subscription.description,
      },
    });
  }

  for (const incomeSource of sampleIncomeSources) {
    const incomeMonth = addMonths(currentMonth, incomeSource.monthOffset);

    await prisma.incomeSource.create({
      data: {
        incomeType: incomeSource.incomeType,
        description: incomeSource.description,
        grossAmount: incomeSource.grossAmount,
        netAmount: incomeSource.netAmount,
        incomeDate: createUtcDate(
          incomeMonth.getUTCFullYear(),
          incomeMonth.getUTCMonth(),
          incomeSource.day,
        ),
        isRecurring: incomeSource.isRecurring,
        recurrenceFrequency: incomeSource.recurrenceFrequency,
        isActive: incomeSource.isActive,
        incomeDeductions: {
          create: incomeSource.deductions.map((deduction) => ({
            deductionType: deduction.deductionType,
            name: deduction.name,
            amount: deduction.amount,
            isPercentage: deduction.isPercentage ?? false,
          })),
        },
      },
    });
  }

  const existingSettings = await prisma.settings.findFirst({
    select: { id: true },
  });

  if (!existingSettings) {
    await prisma.settings.create({
      data: seedSettings,
    });
  }

  console.log(
    `Seeded ${categories.length} categories, ${
      Object.keys(monthlyBudgets.current).length + Object.keys(monthlyBudgets.previous).length
    } budgets, ${sampleTransactions.length} transactions, ${sampleDebts.length} debts, ${
      sampleSavingsGoals.length
    } savings goals, ${sampleHousingExpenses.length} housing expenses, ${
      sampleSubscriptions.length
    } subscriptions, ${sampleIncomeSources.length} income sources, ${
      sampleHolidays.length
    } holidays, and settings`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
