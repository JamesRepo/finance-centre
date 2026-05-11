import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    budgetPlan: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
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
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/budget-plans/route";

describe("[Unit] budget plans route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list saved budget plans with month values and item counts", async () => {
    mockPrisma.budgetPlan.findMany.mockResolvedValue([
      {
        id: 1,
        name: "Annual plan",
        startMonth: new Date("2026-06-01T00:00:00.000Z"),
        endMonth: new Date("2027-05-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-11T10:00:00.000Z"),
        updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        _count: { items: 3 },
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.budgetPlan.findMany).toHaveBeenCalledWith({
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(body).toMatchObject([
      {
        id: 1,
        name: "Annual plan",
        startMonth: "2026-06",
        endMonth: "2027-05",
        itemCount: 3,
      },
    ]);
  });
});

describe("[Unit] budget plans route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.housingExpense.findMany.mockResolvedValue([]);
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    mockPrisma.holiday.findMany.mockResolvedValue([]);
    mockPrisma.debt.findMany.mockResolvedValue([]);
    mockPrisma.incomeSource.findMany.mockResolvedValue([]);
  });

  it("should create a saved plan seeded from existing finance streams", async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "category-1",
        name: "Groceries",
        colorCode: "#22c55e",
        budgets: [{ amount: new Prisma.Decimal("300") }],
      },
    ]);
    mockPrisma.housingExpense.findMany
      .mockResolvedValueOnce([
        {
          expenseType: "RENT",
          amount: new Prisma.Decimal("1200"),
          frequency: "MONTHLY",
        },
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.subscription.findMany.mockResolvedValue([
      {
        id: 7,
        name: "Music",
        amount: new Prisma.Decimal("120"),
        frequency: "YEARLY",
      },
    ]);
    mockPrisma.holiday.findMany.mockResolvedValue([
      {
        id: 4,
        name: "Beach",
        holidayExpenses: [
          { amount: new Prisma.Decimal("800") },
          { amount: new Prisma.Decimal("200") },
        ],
      },
    ]);
    mockPrisma.debt.findMany.mockResolvedValue([
      {
        id: 2,
        name: "Credit card",
        minimumPayment: new Prisma.Decimal("75"),
      },
    ]);
    mockPrisma.incomeSource.findMany.mockResolvedValue([
      {
        id: 5,
        incomeType: "SALARY",
        description: "Main salary",
        netAmount: new Prisma.Decimal("2500"),
        recurrenceFrequency: "MONTHLY",
      },
    ]);
    mockPrisma.budgetPlan.create.mockResolvedValue({
      id: 1,
      name: "Annual plan",
      startMonth: new Date("2026-06-01T00:00:00.000Z"),
      endMonth: new Date("2027-05-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-11T10:00:00.000Z"),
      updatedAt: new Date("2026-05-11T10:00:00.000Z"),
      items: [
        {
          id: 1,
          planId: 1,
          stream: "INCOME",
          sourceId: "5",
          label: "Main salary",
          amount: new Prisma.Decimal("2500"),
          cadence: "MONTHLY",
          colorCode: null,
          sortOrder: 6006,
          isCustom: false,
          enabled: true,
          createdAt: new Date("2026-05-11T10:00:00.000Z"),
          updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        },
        {
          id: 2,
          planId: 1,
          stream: "CATEGORY",
          sourceId: "category-1",
          label: "Groceries",
          amount: new Prisma.Decimal("300"),
          cadence: "MONTHLY",
          colorCode: "#22c55e",
          sortOrder: 100,
          isCustom: false,
          enabled: true,
          createdAt: new Date("2026-05-11T10:00:00.000Z"),
          updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        },
        {
          id: 3,
          planId: 1,
          stream: "HOUSING",
          sourceId: null,
          label: "Housing",
          amount: new Prisma.Decimal("1200"),
          cadence: "MONTHLY",
          colorCode: null,
          sortOrder: 2,
          isCustom: false,
          enabled: true,
          createdAt: new Date("2026-05-11T10:00:00.000Z"),
          updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        },
        {
          id: 4,
          planId: 1,
          stream: "SUBSCRIPTION",
          sourceId: null,
          label: "Subscriptions",
          amount: new Prisma.Decimal("10"),
          cadence: "MONTHLY",
          colorCode: null,
          sortOrder: 3,
          isCustom: false,
          enabled: true,
          createdAt: new Date("2026-05-11T10:00:00.000Z"),
          updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        },
        {
          id: 5,
          planId: 1,
          stream: "HOLIDAY",
          sourceId: null,
          label: "Holidays",
          amount: new Prisma.Decimal("1000"),
          cadence: "YEARLY",
          colorCode: null,
          sortOrder: 4,
          isCustom: false,
          enabled: true,
          createdAt: new Date("2026-05-11T10:00:00.000Z"),
          updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        },
        {
          id: 6,
          planId: 1,
          stream: "DEBT",
          sourceId: null,
          label: "Debts",
          amount: new Prisma.Decimal("75"),
          cadence: "MONTHLY",
          colorCode: null,
          sortOrder: 5,
          isCustom: false,
          enabled: true,
          createdAt: new Date("2026-05-11T10:00:00.000Z"),
          updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        },
        {
          id: 7,
          planId: 1,
          stream: "SAVINGS",
          sourceId: null,
          label: "Savings",
          amount: new Prisma.Decimal("0"),
          cadence: "MONTHLY",
          colorCode: null,
          sortOrder: 6,
          isCustom: false,
          enabled: true,
          createdAt: new Date("2026-05-11T10:00:00.000Z"),
          updatedAt: new Date("2026-05-11T10:00:00.000Z"),
        },
      ],
    });

    const request = new NextRequest("http://localhost/api/budget-plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Annual plan",
        startMonth: "2026-06",
        endMonth: "2027-05",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.budgetPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Annual plan",
        startMonth: new Date("2026-06-01T00:00:00.000Z"),
        endMonth: new Date("2027-05-01T00:00:00.000Z"),
        items: {
          create: expect.arrayContaining([
            expect.objectContaining({
              stream: "CATEGORY",
              label: "Groceries",
              amount: new Prisma.Decimal("300"),
              cadence: "MONTHLY",
            }),
            expect.objectContaining({
              stream: "HOUSING",
              label: "Housing",
              amount: new Prisma.Decimal("1200"),
              cadence: "MONTHLY",
            }),
            expect.objectContaining({
              stream: "SUBSCRIPTION",
              label: "Subscriptions",
              amount: new Prisma.Decimal("10"),
              cadence: "MONTHLY",
            }),
            expect.objectContaining({
              stream: "HOLIDAY",
              label: "Holidays",
              amount: new Prisma.Decimal("1000"),
              cadence: "YEARLY",
            }),
            expect.objectContaining({
              stream: "DEBT",
              label: "Debts",
              amount: new Prisma.Decimal("75"),
              cadence: "MONTHLY",
            }),
          ]),
        },
      }),
      include: {
        items: {
          orderBy: [{ stream: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
        },
      },
    });
    expect(body.summary).toMatchObject({
      income: 30000,
      spending: 19120,
      debtPayments: 900,
      netPosition: 9980,
    });
  });

  it("should reject an invalid month range", async () => {
    const request = new NextRequest("http://localhost/api/budget-plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Invalid plan",
        startMonth: "2026-06",
        endMonth: "2026-05",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "End month must be on or after start month",
    });
    expect(mockPrisma.budgetPlan.create).not.toHaveBeenCalled();
  });
});
