import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/transactions/summary/route";

describe("[Unit] transactions summary route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return the month summary when a valid month query is provided", async () => {
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("210.75") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("10.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("50.25") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("40.50") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("60.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("50.00") },
      });
    mockPrisma.transaction.groupBy.mockResolvedValue([
      {
        categoryId: "cat-2",
        _sum: { amount: new Prisma.Decimal("150.25") },
        _count: { _all: 3 },
      },
      {
        categoryId: "cat-1",
        _sum: { amount: new Prisma.Decimal("60.50") },
        _count: { _all: 2 },
      },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "cat-1",
        name: "Travel",
        colorCode: "#00FF00",
      },
      {
        id: "cat-2",
        name: "Groceries",
        colorCode: "#FF0000",
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/summary?month=2026-04"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalSpent: "210.75",
      byCategory: [
        {
          categoryId: "cat-2",
          categoryName: "Groceries",
          colorCode: "#FF0000",
          total: "150.25",
          transactionCount: 3,
        },
        {
          categoryId: "cat-1",
          categoryName: "Travel",
          colorCode: "#00FF00",
          total: "60.5",
          transactionCount: 2,
        },
      ],
      byWeek: [
        {
          weekNumber: 1,
          weekStart: "2026-04-01",
          weekEnd: "2026-04-05",
          total: "10",
        },
        {
          weekNumber: 2,
          weekStart: "2026-04-06",
          weekEnd: "2026-04-12",
          total: "50.25",
        },
        {
          weekNumber: 3,
          weekStart: "2026-04-13",
          weekEnd: "2026-04-19",
          total: "40.5",
        },
        {
          weekNumber: 4,
          weekStart: "2026-04-20",
          weekEnd: "2026-04-26",
          total: "60",
        },
        {
          weekNumber: 5,
          weekStart: "2026-04-27",
          weekEnd: "2026-04-30",
          total: "50",
        },
      ],
    });
    expect(mockPrisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ["categoryId"],
      where: {
        transactionDate: {
          gte: new Date(Date.UTC(2026, 3, 1)),
          lt: new Date(Date.UTC(2026, 4, 1)),
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
    });
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["cat-2", "cat-1"],
        },
      },
    });
    expect(mockPrisma.transaction.aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        transactionDate: {
          gte: new Date(Date.UTC(2026, 3, 1)),
          lt: new Date(Date.UTC(2026, 4, 1)),
        },
      },
      _sum: {
        amount: true,
      },
    });
  });

  it("should return the year summary when a valid year query is provided", async () => {
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("1200.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("100.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("110.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("120.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("130.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("140.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("150.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("0.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("0.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("160.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("170.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("0.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("220.00") },
      });
    mockPrisma.transaction.groupBy.mockResolvedValue([
      {
        categoryId: "cat-3",
        _sum: { amount: new Prisma.Decimal("800.00") },
        _count: { _all: 8 },
      },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "cat-3",
        name: "Utilities",
        colorCode: "#0000FF",
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/summary?period=year&year=2026"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalSpent: "1200",
      byCategory: [
        {
          categoryId: "cat-3",
          categoryName: "Utilities",
          colorCode: "#0000FF",
          total: "800",
          transactionCount: 8,
        },
      ],
      byMonth: [
        { month: "2026-01", total: "100" },
        { month: "2026-02", total: "110" },
        { month: "2026-03", total: "120" },
        { month: "2026-04", total: "130" },
        { month: "2026-05", total: "140" },
        { month: "2026-06", total: "150" },
        { month: "2026-07", total: "0" },
        { month: "2026-08", total: "0" },
        { month: "2026-09", total: "160" },
        { month: "2026-10", total: "170" },
        { month: "2026-11", total: "0" },
        { month: "2026-12", total: "220" },
      ],
    });
    expect(mockPrisma.transaction.aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        transactionDate: {
          gte: new Date(Date.UTC(2026, 0, 1)),
          lt: new Date(Date.UTC(2027, 0, 1)),
        },
      },
      _sum: {
        amount: true,
      },
    });
    expect(mockPrisma.transaction.aggregate).toHaveBeenNthCalledWith(13, {
      where: {
        transactionDate: {
          gte: new Date(Date.UTC(2026, 11, 1)),
          lt: new Date(Date.UTC(2027, 0, 1)),
        },
      },
      _sum: {
        amount: true,
      },
    });
  });

  it("should return the week summary for the week containing the selected month start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T10:00:00.000Z"));

    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("98.25") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("12.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("0.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("45.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("20.25") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("8.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("13.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("0.00") },
      });
    mockPrisma.transaction.groupBy.mockResolvedValue([
      {
        categoryId: "missing-cat",
        _sum: { amount: new Prisma.Decimal("98.25") },
        _count: { _all: 4 },
      },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/transactions/summary?period=week&month=2026-01",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalSpent: "98.25",
      byCategory: [
        {
          categoryId: "missing-cat",
          categoryName: "Unknown",
          colorCode: null,
          total: "98.25",
          transactionCount: 4,
        },
      ],
      byDay: [
        { date: "2025-12-29", total: "12" },
        { date: "2025-12-30", total: "0" },
        { date: "2025-12-31", total: "45" },
        { date: "2026-01-01", total: "20.25" },
        { date: "2026-01-02", total: "8" },
        { date: "2026-01-03", total: "13" },
        { date: "2026-01-04", total: "0" },
      ],
    });
    expect(mockPrisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ["categoryId"],
      where: {
        transactionDate: {
          gte: new Date(Date.UTC(2025, 11, 29)),
          lt: new Date(Date.UTC(2026, 0, 5)),
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
    });
  });

  it("should default the week summary to the current month when no month query is provided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T10:00:00.000Z"));

    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("51.25") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("2.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("4.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("6.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("8.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("10.25") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("9.00") },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("12.00") },
      });
    mockPrisma.transaction.groupBy.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/summary?period=week"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalSpent: "51.25",
      byCategory: [],
      byDay: [
        { date: "2026-03-30", total: "2" },
        { date: "2026-03-31", total: "4" },
        { date: "2026-04-01", total: "6" },
        { date: "2026-04-02", total: "8" },
        { date: "2026-04-03", total: "10.25" },
        { date: "2026-04-04", total: "9" },
        { date: "2026-04-05", total: "12" },
      ],
    });
    expect(mockPrisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ["categoryId"],
      where: {
        transactionDate: {
          gte: new Date(Date.UTC(2026, 2, 30)),
          lt: new Date(Date.UTC(2026, 3, 6)),
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
    });
  });

  it("should return zero totals and skip category lookups when there are no matching transactions", async () => {
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: null },
      })
      .mockResolvedValueOnce({
        _sum: { amount: null },
      })
      .mockResolvedValueOnce({
        _sum: { amount: null },
      })
      .mockResolvedValueOnce({
        _sum: { amount: null },
      })
      .mockResolvedValueOnce({
        _sum: { amount: null },
      })
      .mockResolvedValueOnce({
        _sum: { amount: null },
      });
    mockPrisma.transaction.groupBy.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/summary?month=2026-02"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalSpent: "0",
      byCategory: [],
      byWeek: [
        {
          weekNumber: 1,
          weekStart: "2026-02-01",
          weekEnd: "2026-02-01",
          total: "0",
        },
        {
          weekNumber: 2,
          weekStart: "2026-02-02",
          weekEnd: "2026-02-08",
          total: "0",
        },
        {
          weekNumber: 3,
          weekStart: "2026-02-09",
          weekEnd: "2026-02-15",
          total: "0",
        },
        {
          weekNumber: 4,
          weekStart: "2026-02-16",
          weekEnd: "2026-02-22",
          total: "0",
        },
        {
          weekNumber: 5,
          weekStart: "2026-02-23",
          weekEnd: "2026-02-28",
          total: "0",
        },
      ],
    });
    expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
  });

  it("should return a 400 error when month has an invalid format", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions/summary?month=2026-4"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.transaction.aggregate).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.groupBy).not.toHaveBeenCalled();
  });

  it("should return a 400 error when year has an invalid format", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions/summary?period=year&year=26"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Year must be in YYYY format",
    });
    expect(mockPrisma.transaction.aggregate).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.groupBy).not.toHaveBeenCalled();
  });
});
