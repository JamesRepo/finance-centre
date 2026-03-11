import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    incomeSource: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    incomeDeduction: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, GET, PUT } from "@/app/api/income/[id]/route";

describe("[Unit] income source item route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an income source with deductions and total deductions when the income source exists", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValue({
      id: 1,
      incomeType: "SALARY",
      description: "Monthly pay",
      grossAmount: new Prisma.Decimal("3500"),
      netAmount: new Prisma.Decimal("2800"),
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
        {
          id: 12,
          incomeSourceId: 1,
          deductionType: "NI",
          name: "National Insurance",
          amount: new Prisma.Decimal("200"),
          isPercentage: false,
          percentageValue: null,
          isActive: true,
          createdAt: new Date("2026-03-31T00:00:00.000Z"),
        },
      ],
    });

    const response = await GET(new NextRequest("http://localhost/api/income/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.incomeSource.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
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
      totalDeductions: "700",
    });
  });

  it("should return a 400 error when the income source id is invalid", async () => {
    const response = await GET(new NextRequest("http://localhost/api/income/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid income source id",
    });
    expect(mockPrisma.incomeSource.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the income source does not exist", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/income/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Income source not found",
    });
  });
});

describe("[Unit] income source item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update an income source and replace deductions when the payload is valid", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValueOnce({
      id: 1,
    });
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) =>
      callback(mockPrisma),
    );
    mockPrisma.incomeSource.update.mockResolvedValue({
      id: 1,
    });
    mockPrisma.incomeDeduction.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.incomeDeduction.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.incomeSource.findUnique.mockResolvedValueOnce({
      id: 1,
      incomeType: "SALARY",
      description: "Updated salary",
      grossAmount: new Prisma.Decimal("4000"),
      netAmount: new Prisma.Decimal("3000"),
      incomeDate: new Date("2026-04-30T00:00:00.000Z"),
      isRecurring: true,
      recurrenceFrequency: "MONTHLY",
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      incomeDeductions: [
        {
          id: 21,
          incomeSourceId: 1,
          deductionType: "INCOME_TAX",
          name: "Income Tax",
          amount: new Prisma.Decimal("600"),
          isPercentage: false,
          percentageValue: null,
          isActive: true,
          createdAt: new Date("2026-04-30T00:00:00.000Z"),
        },
        {
          id: 22,
          incomeSourceId: 1,
          deductionType: "PENSION",
          name: "Pension",
          amount: new Prisma.Decimal("150"),
          isPercentage: false,
          percentageValue: null,
          isActive: true,
          createdAt: new Date("2026-04-30T00:00:00.000Z"),
        },
      ],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/income/1", {
        method: "PUT",
        body: JSON.stringify({
          description: " Updated salary ",
          grossAmount: "4000",
          netAmount: "3000",
          deductions: [
            {
              deductionType: "INCOME_TAX",
              name: " Income Tax ",
              amount: "600",
            },
            {
              deductionType: "PENSION",
              name: " Pension ",
              amount: "150",
            },
          ],
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.incomeSource.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Updated salary",
        grossAmount: 4000,
        netAmount: 3000,
      },
    });
    expect(mockPrisma.incomeDeduction.deleteMany).toHaveBeenCalledWith({
      where: { incomeSourceId: 1 },
    });
    expect(mockPrisma.incomeDeduction.createMany).toHaveBeenCalledWith({
      data: [
        {
          incomeSourceId: 1,
          deductionType: "INCOME_TAX",
          name: "Income Tax",
          amount: 600,
        },
        {
          incomeSourceId: 1,
          deductionType: "PENSION",
          name: "Pension",
          amount: 150,
        },
      ],
    });
    expect(body).toMatchObject({
      id: 1,
      totalDeductions: "750",
    });
  });

  it("should clear deductions without updating income source fields when an empty replacement array is provided", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValueOnce({
      id: 1,
    });
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) =>
      callback(mockPrisma),
    );
    mockPrisma.incomeDeduction.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.incomeSource.findUnique.mockResolvedValueOnce({
      id: 1,
      incomeType: "BONUS",
      description: null,
      grossAmount: new Prisma.Decimal("1000"),
      netAmount: new Prisma.Decimal("1000"),
      incomeDate: new Date("2026-04-30T00:00:00.000Z"),
      isRecurring: false,
      recurrenceFrequency: null,
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      incomeDeductions: [],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/income/1", {
        method: "PUT",
        body: JSON.stringify({
          deductions: [],
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.incomeSource.update).not.toHaveBeenCalled();
    expect(mockPrisma.incomeDeduction.deleteMany).toHaveBeenCalledWith({
      where: { incomeSourceId: 1 },
    });
    expect(mockPrisma.incomeDeduction.createMany).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      id: 1,
      totalDeductions: "0",
    });
  });

  it("should return a 400 error when the income source id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/income/nope", {
        method: "PUT",
        body: JSON.stringify({
          netAmount: 100,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid income source id",
    });
    expect(mockPrisma.incomeSource.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the income source does not exist", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/income/999", {
        method: "PUT",
        body: JSON.stringify({
          netAmount: 100,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Income source not found",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/income/1", {
        method: "PUT",
        body: JSON.stringify({
          description: "   ",
          recurrenceFrequency: "",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field is required",
    });
    expect(mockPrisma.incomeSource.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/income/1", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});

describe("[Unit] income source item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete an income source when the income source exists", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValue({
      id: 1,
    });

    const response = await DELETE(new NextRequest("http://localhost/api/income/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.incomeSource.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the income source id is invalid", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/income/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid income source id",
    });
    expect(mockPrisma.incomeSource.delete).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the income source does not exist", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/income/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Income source not found",
    });
    expect(mockPrisma.incomeSource.delete).not.toHaveBeenCalled();
  });
});
