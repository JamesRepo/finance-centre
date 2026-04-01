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
  { name: "Groceries", colorCode: "#22c55e" },
  { name: "Eating Out", colorCode: "#f59e0b" },
  { name: "Transport", colorCode: "#3b82f6" },
  { name: "Fun / Exercise", colorCode: "#a855f7" },
  { name: "Shopping", colorCode: "#ec4899" },
  { name: "Personal Care", colorCode: "#14b8a6" },
  { name: "Pub / Going Out", colorCode: "#64748b" },
  { name: "Clothes", colorCode: "#f97316" },
  { name: "Personal Development / Tech", colorCode: "#6366f1" },
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
    amount: 68.45,
    daysAgo: 2,
    description: "[Seed] Weekly food shop",
    vendor: "Tesco",
  },
  {
    categoryName: "Eating Out",
    amount: 24.8,
    daysAgo: 4,
    description: "[Seed] Dinner with friends",
    vendor: "Dishoom",
  },
  {
    categoryName: "Transport",
    amount: 16.2,
    daysAgo: 6,
    description: "[Seed] Train tickets",
    vendor: "National Rail",
  },
  {
    categoryName: "Shopping",
    amount: 52.99,
    daysAgo: 9,
    description: "[Seed] Home bits",
    vendor: "Amazon",
  },
  {
    categoryName: "Personal Development / Tech",
    amount: 19,
    daysAgo: 11,
    description: "[Seed] App subscription",
    vendor: "OpenAI",
  },
  {
    categoryName: "Groceries",
    amount: 74.15,
    daysAgo: 34,
    description: "[Seed] Last month food shop",
    vendor: "Sainsbury's",
  },
  {
    categoryName: "Pub / Going Out",
    amount: 31.5,
    daysAgo: 38,
    description: "[Seed] Friday drinks",
    vendor: "Local Pub",
  },
  {
    categoryName: "Clothes",
    amount: 45,
    daysAgo: 42,
    description: "[Seed] Basics refresh",
    vendor: "Uniqlo",
  },
] as const;

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
      update: {},
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

  for (const transaction of sampleTransactions) {
    const categoryId = categoryIdByName.get(transaction.categoryName);

    if (!categoryId) {
      throw new Error(`Missing category for sample transaction: ${transaction.categoryName}`);
    }

    await prisma.transaction.create({
      data: {
        categoryId,
        amount: transaction.amount,
        transactionDate: subtractDays(now, transaction.daysAgo),
        description: transaction.description,
        vendor: transaction.vendor,
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

  console.log(
    `Seeded ${categories.length} categories, ${
      Object.keys(monthlyBudgets.current).length + Object.keys(monthlyBudgets.previous).length
    } budgets, ${sampleTransactions.length} transactions, and ${sampleHolidays.length} holidays`,
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
