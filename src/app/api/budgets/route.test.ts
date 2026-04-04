import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    budget: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    transaction: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/budgets/route";

describe("[Unit] budgets route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return every category with budget and spent totals when the month is valid", async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "category-1",
        name: "Groceries",
        colorCode: "#22c55e",
        isSystem: true,
        showOnDashboardDailySpending: true,
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        budgets: [
          {
            id: "budget-1",
            categoryId: "category-1",
            amount: new Prisma.Decimal("500.00"),
            month: new Date("2026-03-01T00:00:00.000Z"),
            createdAt: new Date("2026-03-01T12:00:00.000Z"),
          },
        ],
      },
      {
        id: "category-2",
        name: "Transport",
        colorCode: "#3b82f6",
        isSystem: true,
        showOnDashboardDailySpending: false,
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        budgets: [],
      },
    ]);
    mockPrisma.transaction.groupBy.mockResolvedValue([
      {
        categoryId: "category-1",
        _count: {
          _all: 3,
        },
        _sum: {
          amount: new Prisma.Decimal("123.45"),
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/budgets?month=2026-03");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      include: {
        budgets: {
          where: {
            month: {
              gte: new Date("2026-03-01T00:00:00.000Z"),
              lt: new Date("2026-04-01T00:00:00.000Z"),
            },
          },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    expect(mockPrisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ["categoryId"],
      where: {
        transactionDate: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
      },
    });
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      budgetId: "budget-1",
      categoryId: "category-1",
      amount: "500",
      spent: "123.45",
      category: {
        id: "category-1",
        name: "Groceries",
        showOnDashboardDailySpending: true,
      },
      transactionCount: 3,
    });
    expect(body[1]).toMatchObject({
      budgetId: null,
      categoryId: "category-2",
      amount: "0",
      spent: "0",
      transactionCount: 0,
      category: {
        showOnDashboardDailySpending: false,
      },
    });
  });

  it("should return a validation error when the month query is missing", async () => {
    const request = new NextRequest("http://localhost/api/budgets");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid input: expected string, received undefined",
    });
    expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.groupBy).not.toHaveBeenCalled();
  });

  it("should return a validation error when the month query is malformed", async () => {
    const request = new NextRequest("http://localhost/api/budgets?month=2026-3");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] budgets route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a budget when the category exists and no budget exists for that month", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      name: "Groceries",
    });
    mockPrisma.budget.findUnique.mockResolvedValue(null);
    mockPrisma.budget.upsert.mockResolvedValue({
      id: "budget-1",
      categoryId: "category-1",
      amount: new Prisma.Decimal("300.00"),
      month: new Date("2026-03-01T00:00:00.000Z"),
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      category: {
        id: "category-1",
        name: "Groceries",
      },
    });

    const request = new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        categoryId: "category-1",
        month: "2026-03",
        amount: "300.00",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: "category-1" },
    });
    expect(mockPrisma.budget.findUnique).toHaveBeenCalledWith({
      where: {
        categoryId_month: {
          categoryId: "category-1",
          month: new Date("2026-03-01T00:00:00.000Z"),
        },
      },
    });
    expect(mockPrisma.budget.upsert).toHaveBeenCalledWith({
      where: {
        categoryId_month: {
          categoryId: "category-1",
          month: new Date("2026-03-01T00:00:00.000Z"),
        },
      },
      update: {
        amount: 300,
      },
      create: {
        categoryId: "category-1",
        month: new Date("2026-03-01T00:00:00.000Z"),
        amount: 300,
      },
      include: {
        category: true,
      },
    });
    expect(body).toMatchObject({
      id: "budget-1",
      categoryId: "category-1",
      amount: "300",
    });
  });

  it("should update a budget when a budget already exists for the category and month", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      name: "Groceries",
    });
    mockPrisma.budget.findUnique.mockResolvedValue({
      id: "budget-1",
    });
    mockPrisma.budget.upsert.mockResolvedValue({
      id: "budget-1",
      categoryId: "category-1",
      amount: new Prisma.Decimal("450.00"),
      month: new Date("2026-03-01T00:00:00.000Z"),
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      category: {
        id: "category-1",
        name: "Groceries",
      },
    });

    const request = new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        categoryId: "category-1",
        month: "2026-03",
        amount: 450,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.budget.upsert).toHaveBeenCalledOnce();
  });

  it("should allow a zero budget when the request body sets amount to zero", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      name: "Groceries",
    });
    mockPrisma.budget.findUnique.mockResolvedValue({
      id: "budget-1",
    });
    mockPrisma.budget.upsert.mockResolvedValue({
      id: "budget-1",
      categoryId: "category-1",
      amount: new Prisma.Decimal("0.00"),
      month: new Date("2026-03-01T00:00:00.000Z"),
      createdAt: new Date("2026-03-01T12:00:00.000Z"),
      category: {
        id: "category-1",
        name: "Groceries",
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          categoryId: "category-1",
          month: "2026-03",
          amount: 0,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.budget.upsert).toHaveBeenCalledWith({
      where: {
        categoryId_month: {
          categoryId: "category-1",
          month: new Date("2026-03-01T00:00:00.000Z"),
        },
      },
      update: {
        amount: 0,
      },
      create: {
        categoryId: "category-1",
        month: new Date("2026-03-01T00:00:00.000Z"),
        amount: 0,
      },
      include: {
        category: true,
      },
    });
  });

  it("should return a validation error when the request body amount is negative", async () => {
    const request = new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        categoryId: "category-1",
        month: "2026-03",
        amount: -1,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Too small: expected number to be >=0",
    });
    expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
  });

  it("should return a validation error when the request body is invalid json", async () => {
    const request = new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      body: "{",
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid JSON body",
    });
  });

  it("should return an error when the category does not exist", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        categoryId: "missing-category",
        month: "2026-03",
        amount: 120,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Category not found",
    });
    expect(mockPrisma.budget.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.budget.upsert).not.toHaveBeenCalled();
  });
});
