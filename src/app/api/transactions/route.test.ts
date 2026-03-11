import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/transactions/route";

describe("[Unit] transactions collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return transactions when valid filters are provided", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: "txn-1",
        amount: "12.50",
        transactionDate: "2026-03-10T12:00:00.000Z",
        category: { id: "cat-1", name: "Groceries" },
      },
    ]);

    const request = new NextRequest(
      "http://localhost/api/transactions?month=2026-03&categoryId=cat-1",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "txn-1",
        amount: "12.50",
        transactionDate: "2026-03-10T12:00:00.000Z",
        category: { id: "cat-1", name: "Groceries" },
      },
    ]);
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        transactionDate: {
          gte: new Date(Date.UTC(2026, 2, 1)),
          lt: new Date(Date.UTC(2026, 3, 1)),
        },
        categoryId: "cat-1",
      },
      include: {
        category: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
    });
  });

  it("should list transactions without filters when no query params are provided", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost/api/transactions"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
      where: {},
      include: {
        category: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
    });
  });

  it("should return a 400 error when month has an invalid format", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions?month=2026-3"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it("should return a 400 error when month is zero", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions?month=2026-00"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it("should return a 400 error when month is greater than twelve", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions?month=2026-13"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] transactions collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a transaction when the payload and category are valid", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "Groceries",
    });
    mockPrisma.transaction.create.mockResolvedValue({
      id: "txn-1",
      amount: "12.5",
      transactionDate: "2026-03-10T12:00:00.000Z",
      description: "Lunch",
      vendor: "Cafe",
      categoryId: "cat-1",
      category: {
        id: "cat-1",
        name: "Groceries",
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: "12.5",
          transactionDate: "2026-03-10T12:00:00.000Z",
          description: " Lunch ",
          vendor: " Cafe ",
          categoryId: "cat-1",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: "cat-1" },
    });
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
      data: {
        amount: 12.5,
        transactionDate: new Date("2026-03-10T12:00:00.000Z"),
        description: "Lunch",
        vendor: "Cafe",
        categoryId: "cat-1",
      },
      include: {
        category: true,
      },
    });
    expect(await response.json()).toEqual({
      id: "txn-1",
      amount: "12.5",
      transactionDate: "2026-03-10T12:00:00.000Z",
      description: "Lunch",
      vendor: "Cafe",
      categoryId: "cat-1",
      category: {
        id: "cat-1",
        name: "Groceries",
      },
    });
  });

  it("should return a 400 error when the category does not exist", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: 12.5,
          transactionDate: "2026-03-10T12:00:00.000Z",
          categoryId: "missing-category",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Category not found",
    });
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: 0,
          transactionDate: "2026-03-10T12:00:00.000Z",
          categoryId: "cat-1",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Too small: expected number to be >0",
    });
    expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});
