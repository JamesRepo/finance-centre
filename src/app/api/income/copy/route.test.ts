import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    incomeSource: {
      findMany: vi.fn(),
      create: vi.fn((args) => args),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/income/copy/route";

describe("[Unit] income copy route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incomeSource.create.mockImplementation((args) => args);
  });

  it("should copy source income with deductions and skip duplicate target entries", async () => {
    mockPrisma.incomeSource.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          incomeType: "SALARY",
          description: "Monthly pay",
          grossAmount: new Prisma.Decimal("4200"),
          netAmount: new Prisma.Decimal("3100"),
          incomeDate: new Date("2026-03-31T00:00:00.000Z"),
          isRecurring: true,
          recurrenceFrequency: "MONTHLY",
          isActive: true,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          incomeDeductions: [
            {
              id: 11,
              incomeSourceId: 1,
              deductionType: "INCOME_TAX",
              name: "Income Tax",
              amount: new Prisma.Decimal("700"),
              isPercentage: false,
              percentageValue: null,
              isActive: true,
              createdAt: new Date("2026-03-31T00:00:00.000Z"),
            },
          ],
        },
        {
          id: 2,
          incomeType: "BONUS",
          description: null,
          grossAmount: new Prisma.Decimal("500"),
          netAmount: new Prisma.Decimal("500"),
          incomeDate: new Date("2026-03-15T00:00:00.000Z"),
          isRecurring: false,
          recurrenceFrequency: null,
          isActive: true,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          incomeDeductions: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          incomeType: "BONUS",
          description: null,
          grossAmount: new Prisma.Decimal("500"),
          netAmount: new Prisma.Decimal("500"),
          incomeDate: new Date("2026-04-15T00:00:00.000Z"),
        },
      ]);

    const response = await POST(
      new NextRequest("http://localhost/api/income/copy", {
        method: "POST",
        body: JSON.stringify({
          sourceMonth: "2026-03",
          targetMonth: "2026-04",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.incomeSource.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        incomeDate: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
      include: {
        incomeDeductions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: [{ incomeDate: "asc" }, { incomeType: "asc" }],
    });
    expect(mockPrisma.incomeSource.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        incomeDate: {
          gte: new Date("2026-04-01T00:00:00.000Z"),
          lt: new Date("2026-05-01T00:00:00.000Z"),
        },
      },
      select: {
        incomeType: true,
        description: true,
        grossAmount: true,
        netAmount: true,
        incomeDate: true,
      },
    });
    expect(mockPrisma.incomeSource.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.incomeSource.create).toHaveBeenCalledWith({
      data: {
        incomeType: "SALARY",
        description: "Monthly pay",
        grossAmount: new Prisma.Decimal("4200"),
        netAmount: new Prisma.Decimal("3100"),
        incomeDate: new Date("2026-04-30T00:00:00.000Z"),
        isRecurring: true,
        recurrenceFrequency: "MONTHLY",
        isActive: true,
        incomeDeductions: {
          create: [
            {
              deductionType: "INCOME_TAX",
              name: "Income Tax",
              amount: new Prisma.Decimal("700"),
              isPercentage: false,
              percentageValue: null,
              isActive: true,
            },
          ],
        },
      },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith([
      mockPrisma.incomeSource.create.mock.results[0].value,
    ]);
    expect(await response.json()).toEqual({
      copiedCount: 1,
      skippedCount: 1,
    });
  });

  it("should skip the transaction when every source entry already exists in the target month", async () => {
    const matchingIncome = {
      incomeType: "SALARY",
      description: "Monthly pay",
      grossAmount: new Prisma.Decimal("4200"),
      netAmount: new Prisma.Decimal("3100"),
    };

    mockPrisma.incomeSource.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          ...matchingIncome,
          incomeDate: new Date("2026-01-31T00:00:00.000Z"),
          isRecurring: true,
          recurrenceFrequency: "MONTHLY",
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          incomeDeductions: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          ...matchingIncome,
          incomeDate: new Date("2026-02-28T00:00:00.000Z"),
        },
      ]);

    const response = await POST(
      new NextRequest("http://localhost/api/income/copy", {
        method: "POST",
        body: JSON.stringify({
          sourceMonth: "2026-01",
          targetMonth: "2026-02",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.incomeSource.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      copiedCount: 0,
      skippedCount: 1,
    });
  });

  it("should return a 400 error when the payload fails validation", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/income/copy", {
        method: "POST",
        body: JSON.stringify({
          sourceMonth: "2026-3",
          targetMonth: "2026-04",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.incomeSource.findMany).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/income/copy", {
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
