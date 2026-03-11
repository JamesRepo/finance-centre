import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    incomeSource: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/income/route";

describe("[Unit] income collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return income sources with deductions and total deductions when the query is valid", async () => {
    mockPrisma.incomeSource.findMany.mockResolvedValue([
      {
        id: 1,
        incomeType: "SALARY",
        description: "Salary",
        grossAmount: new Prisma.Decimal("4200"),
        netAmount: new Prisma.Decimal("3100"),
        incomeDate: new Date("2026-03-25T00:00:00.000Z"),
        isRecurring: true,
        recurrenceFrequency: "MONTHLY",
        isActive: true,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        incomeDeductions: [
          {
            id: 11,
            incomeSourceId: 1,
            deductionType: "PENSION",
            name: "Pension",
            amount: new Prisma.Decimal("100"),
            isPercentage: false,
            percentageValue: null,
            isActive: true,
            createdAt: new Date("2026-03-25T00:00:00.000Z"),
          },
          {
            id: 12,
            incomeSourceId: 1,
            deductionType: "INCOME_TAX",
            name: "Tax",
            amount: new Prisma.Decimal("650"),
            isPercentage: false,
            percentageValue: null,
            isActive: true,
            createdAt: new Date("2026-03-25T00:00:00.000Z"),
          },
        ],
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/income?month=2026-03"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.incomeSource.findMany).toHaveBeenCalledWith({
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
      orderBy: {
        incomeDate: "desc",
      },
    });
    expect(body).toEqual([
      expect.objectContaining({
        id: 1,
        totalDeductions: "750",
      }),
    ]);
  });

  it("should return a 400 error when the month filter is invalid", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/income?month=2026-13"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.incomeSource.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] income collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an income source with nested deductions when the payload is valid", async () => {
    mockPrisma.incomeSource.create.mockResolvedValue({
      id: 1,
      incomeType: "SALARY",
      description: "Monthly pay",
      grossAmount: new Prisma.Decimal("3500"),
      netAmount: new Prisma.Decimal("2750"),
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
          amount: new Prisma.Decimal("500"),
          isPercentage: false,
          percentageValue: null,
          isActive: true,
          createdAt: new Date("2026-03-31T00:00:00.000Z"),
        },
      ],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/income", {
        method: "POST",
        body: JSON.stringify({
          incomeType: "SALARY",
          description: " Monthly pay ",
          grossAmount: "3500",
          netAmount: "2750",
          incomeDate: "2026-03-31T00:00:00.000Z",
          isRecurring: true,
          recurrenceFrequency: "MONTHLY",
          deductions: [
            {
              deductionType: "INCOME_TAX",
              name: " Income Tax ",
              amount: "500",
            },
          ],
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.incomeSource.create).toHaveBeenCalledWith({
      data: {
        incomeType: "SALARY",
        description: "Monthly pay",
        grossAmount: 3500,
        netAmount: 2750,
        incomeDate: new Date("2026-03-31T00:00:00.000Z"),
        isRecurring: true,
        recurrenceFrequency: "MONTHLY",
        incomeDeductions: {
          create: [
            {
              deductionType: "INCOME_TAX",
              name: "Income Tax",
              amount: 500,
            },
          ],
        },
      },
      include: {
        incomeDeductions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
    expect(body).toMatchObject({
      id: 1,
      totalDeductions: "500",
    });
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/income", {
        method: "POST",
        body: JSON.stringify({
          incomeType: "DIVIDEND",
          grossAmount: 1000,
          netAmount: 900,
          incomeDate: "2026-03-31T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid option: expected one of \"SALARY\"|\"BONUS\"|\"GIFT\"|\"FREELANCE\"|\"OTHER\"",
    });
    expect(mockPrisma.incomeSource.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/income", {
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
}
);
