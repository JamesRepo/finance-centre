import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    category: {
      findMany: vi.fn(),
    },
    housingExpense: {
      findMany: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
    },
    holiday: {
      findMany: vi.fn(),
    },
    debt: {
      findMany: vi.fn(),
    },
    incomeSource: {
      findMany: vi.fn(),
    },
    budgetPlan: {
      findUnique: vi.fn(),
    },
    budgetPlanItem: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  buildSeedItems,
  formatMonthValue,
  generatePlanMonths,
  getMonthStart,
  getNextSortOrder,
  serializeBudgetPlan,
} from "@/lib/budget-plans/service";

function decimal(value: string | number) {
  return new Prisma.Decimal(value);
}

function planItem(overrides: Partial<Parameters<typeof serializeBudgetPlan>[0]["items"][number]>) {
  const now = new Date("2026-05-11T10:00:00.000Z");

  return {
    id: 1,
    planId: 7,
    stream: "CATEGORY",
    sourceId: null,
    label: "Groceries",
    amount: decimal("0"),
    cadence: "MONTHLY",
    colorCode: null,
    sortOrder: 1,
    isCustom: false,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("[Unit] budget plan month helpers", () => {
  it("should format the UTC month start when a month value is parsed", () => {
    expect(getMonthStart("2026-06")).toEqual(
      new Date("2026-06-01T00:00:00.000Z"),
    );
    expect(formatMonthValue(new Date("2026-12-01T12:00:00.000Z"))).toBe(
      "2026-12",
    );
  });

  it("should generate inclusive month values when the range crosses a year boundary", () => {
    expect(generatePlanMonths("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});

describe("[Unit] serializeBudgetPlan", () => {
  it("should calculate monthly cashflow and summary totals when items have mixed streams and cadences", () => {
    const plan = serializeBudgetPlan({
      id: 7,
      name: "Winter plan",
      startMonth: new Date("2026-12-01T00:00:00.000Z"),
      endMonth: new Date("2027-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-11T10:00:00.000Z"),
      updatedAt: new Date("2026-05-11T10:00:00.000Z"),
      items: [
        planItem({
          id: 1,
          stream: "INCOME",
          label: "Income",
          amount: decimal("3000"),
        }),
        planItem({
          id: 2,
          stream: "CATEGORY",
          label: "Groceries",
          amount: decimal("250"),
        }),
        planItem({
          id: 3,
          stream: "HOLIDAY",
          label: "Holidays",
          amount: decimal("1200"),
          cadence: "YEARLY",
        }),
        planItem({
          id: 4,
          stream: "DEBT",
          label: "Loan",
          amount: decimal("75"),
        }),
        planItem({
          id: 5,
          stream: "SAVINGS",
          label: "Emergency fund",
          amount: decimal("200"),
          enabled: false,
        }),
      ],
    });

    expect(plan.monthlyCashflow).toHaveLength(3);
    expect(plan.monthlyCashflow[0]).toMatchObject({
      month: "2026-12",
      income: 3000,
      spending: 350,
      debtPayments: 75,
      savings: 0,
      outgoings: 425,
      netPosition: 2575,
    });
    expect(plan.summary).toEqual({
      income: 9000,
      spending: 1050,
      debtPayments: 225,
      savings: 0,
      outgoings: 1275,
      netPosition: 7725,
      averageMonthlyNet: 2575,
    });
    expect(plan.items.find((item) => item.id === 3)).toMatchObject({
      monthlyEquivalent: 100,
      periodTotal: 300,
    });
    expect(plan.items.find((item) => item.id === 5)).toMatchObject({
      periodTotal: 600,
    });
  });
});

describe("[Unit] buildSeedItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.housingExpense.findMany.mockResolvedValue([]);
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);
    mockPrisma.debt.findMany.mockResolvedValue([]);
    mockPrisma.incomeSource.findMany.mockResolvedValue([]);
  });

  it("should seed planner items from current finance data when source records exist", async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "cat-1",
        name: "Food",
        colorCode: "#16a34a",
        budgets: [{ amount: decimal("425") }],
      },
    ]);
    mockPrisma.housingExpense.findMany
      .mockResolvedValueOnce([
        {
          expenseType: "RENT",
          amount: decimal("1200"),
          frequency: "MONTHLY",
        },
      ])
      .mockResolvedValueOnce([
        {
          expenseType: "RENT",
          amount: decimal("1000"),
          frequency: "MONTHLY",
        },
        {
          expenseType: "INSURANCE",
          amount: decimal("600"),
          frequency: "YEARLY",
        },
      ]);
    mockPrisma.subscription.findMany.mockResolvedValue([
      {
        amount: decimal("120"),
        frequency: "YEARLY",
      },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([
      {
        holidayExpenses: [
          { amount: decimal("800") },
          { amount: decimal("400") },
        ],
      },
    ]);
    mockPrisma.debt.findMany.mockResolvedValue([
      {
        minimumPayment: decimal("90"),
      },
    ]);
    mockPrisma.incomeSource.findMany.mockResolvedValue([
      {
        netAmount: decimal("24000"),
        recurrenceFrequency: "ANNUALLY",
      },
      {
        netAmount: decimal("300"),
        recurrenceFrequency: "WEEKLY",
      },
      {
        netAmount: decimal("999"),
        recurrenceFrequency: "ONE_OFF",
      },
    ]);

    const items = await buildSeedItems("2026-06");

    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      include: {
        budgets: {
          where: {
            month: {
              gte: new Date("2026-06-01T00:00:00.000Z"),
              lt: new Date("2026-07-01T00:00:00.000Z"),
            },
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
    expect(mockPrisma.incomeSource.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        isRecurring: true,
        NOT: { recurrenceFrequency: "ONE_OFF" },
      },
      orderBy: [{ incomeDate: "asc" }, { incomeType: "asc" }],
    });
    expect(items.find((item) => item.stream === "INCOME")?.amount.toString()).toBe(
      "3300",
    );
    expect(items.find((item) => item.stream === "CATEGORY")).toMatchObject({
      sourceId: "cat-1",
      label: "Food",
      colorCode: "#16a34a",
      sortOrder: 100,
    });
    expect(items.find((item) => item.stream === "CATEGORY")?.amount.toString()).toBe(
      "425",
    );
    expect(items.find((item) => item.stream === "HOUSING")?.amount.toString()).toBe(
      "1250",
    );
    expect(
      items.find((item) => item.stream === "SUBSCRIPTION")?.amount.toString(),
    ).toBe("10");
    expect(items.find((item) => item.stream === "HOLIDAY")).toMatchObject({
      amount: decimal("1200"),
      cadence: "YEARLY",
    });
    expect(items.find((item) => item.stream === "DEBT")?.amount.toString()).toBe(
      "90",
    );
    expect(items.find((item) => item.stream === "SAVINGS")).toMatchObject({
      amount: 0,
      enabled: true,
    });
  });
});

describe("[Unit] getNextSortOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should increment the highest existing sort order when an item exists in the stream", async () => {
    mockPrisma.budgetPlanItem.findFirst.mockResolvedValue({ sortOrder: 42 });

    await expect(getNextSortOrder(7, "CATEGORY")).resolves.toBe(43);
    expect(mockPrisma.budgetPlanItem.findFirst).toHaveBeenCalledWith({
      where: { planId: 7, stream: "CATEGORY" },
      orderBy: { sortOrder: "desc" },
    });
  });

  it("should start at one when the stream has no existing items", async () => {
    mockPrisma.budgetPlanItem.findFirst.mockResolvedValue(null);

    await expect(getNextSortOrder(7, "CATEGORY")).resolves.toBe(1);
  });
});
