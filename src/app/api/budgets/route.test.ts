import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    budget: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
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

  it("should return budgets with category and spent totals when the month is valid", async () => {
    mockPrisma.budget.findMany.mockResolvedValue([
      {
        id: "budget-1",
        categoryId: "category-1",
        amount: new Prisma.Decimal("500.00"),
        month: new Date("2026-03-01T00:00:00.000Z"),
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        category: {
          id: "category-1",
          name: "Groceries",
          colorCode: "#22c55e",
          isSystem: true,
          createdAt: new Date("2026-03-01T12:00:00.000Z"),
        },
      },
      {
        id: "budget-2",
        categoryId: "category-2",
        amount: new Prisma.Decimal("100.00"),
        month: new Date("2026-03-01T00:00:00.000Z"),
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        category: {
          id: "category-2",
          name: "Transport",
          colorCode: "#3b82f6",
          isSystem: true,
          createdAt: new Date("2026-03-01T12:00:00.000Z"),
        },
      },
    ]);
    mockPrisma.transaction.groupBy.mockResolvedValue([
      {
        categoryId: "category-1",
        _sum: {
          amount: new Prisma.Decimal("123.45"),
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/budgets?month=2026-03");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.budget.findMany).toHaveBeenCalledWith({
      where: {
        month: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        category: {
          name: "asc",
        },
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
      _sum: {
        amount: true,
      },
    });
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      id: "budget-1",
      categoryId: "category-1",
      spent: "123.45",
    });
    expect(body[1]).toMatchObject({
      id: "budget-2",
      categoryId: "category-2",
      spent: "0",
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
    expect(mockPrisma.budget.findMany).not.toHaveBeenCalled();
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

  it("should return a validation error when the request body is invalid", async () => {
    const request = new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        categoryId: "category-1",
        month: "2026-03",
        amount: 0,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Too small: expected number to be >0",
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
