import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    debt: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, GET, PUT } from "@/app/api/debts/[id]/route";

describe("[Unit] debt item route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a debt with currentBalance when the debt exists", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue({
      id: 1,
      name: "Visa",
      debtType: "CREDIT_CARD",
      originalBalance: new Prisma.Decimal("1000"),
      interestRate: new Prisma.Decimal("19.99"),
      minimumPayment: null,
      startDate: null,
      targetPayoffDate: null,
      isActive: true,
      notes: null,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      debtPayments: [
        {
          id: 12,
          debtId: 1,
          amount: new Prisma.Decimal("125.50"),
          interestAmount: new Prisma.Decimal("25.50"),
          paymentDate: new Date("2026-03-10T00:00:00.000Z"),
          note: "March",
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
        },
      ],
    });

    const response = await GET(new NextRequest("http://localhost/api/debts/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.debt.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        debtPayments: {
          orderBy: {
            paymentDate: "desc",
          },
        },
      },
    });
    expect(body).toMatchObject({
      id: 1,
      totalPaid: "125.5",
      totalInterestPaid: "25.5",
      principalPaid: "100",
      currentBalance: "900",
    });
  });

  it("should return a 400 error when the debt id is invalid", async () => {
    const response = await GET(new NextRequest("http://localhost/api/debts/not-a-number"), {
      params: Promise.resolve({ id: "not-a-number" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid debt id",
    });
    expect(mockPrisma.debt.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the debt does not exist", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/debts/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Debt not found",
    });
  });
});

describe("[Unit] debt item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a debt when the debt exists and the payload is valid", async () => {
    mockPrisma.debt.findUnique.mockResolvedValueOnce({
      id: 1,
    });
    mockPrisma.debt.update.mockResolvedValue({
      id: 1,
      name: "Visa Updated",
      debtType: "CREDIT_CARD",
      originalBalance: new Prisma.Decimal("1200"),
      interestRate: new Prisma.Decimal("18.99"),
      minimumPayment: new Prisma.Decimal("60"),
      startDate: null,
      targetPayoffDate: null,
      isActive: true,
      notes: "Updated note",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      debtPayments: [
        {
          id: 12,
          debtId: 1,
          amount: new Prisma.Decimal("200"),
          interestAmount: new Prisma.Decimal("20"),
          paymentDate: new Date("2026-03-10T00:00:00.000Z"),
          note: null,
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
        },
      ],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1", {
        method: "PUT",
        body: JSON.stringify({
          name: " Visa Updated ",
          originalBalance: "1200",
          interestRate: "18.99",
          minimumPayment: "60",
          notes: " Updated note ",
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
    expect(mockPrisma.debt.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "Visa Updated",
        originalBalance: 1200,
        interestRate: 18.99,
        minimumPayment: 60,
        notes: "Updated note",
      },
      include: {
        debtPayments: {
          orderBy: {
            paymentDate: "desc",
          },
        },
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      totalPaid: "200",
      totalInterestPaid: "20",
      principalPaid: "180",
      currentBalance: "1020",
    });
  });

  it("should clear nullable debt fields when the payload sets them to null", async () => {
    mockPrisma.debt.findUnique.mockResolvedValueOnce({
      id: 1,
    });
    mockPrisma.debt.update.mockResolvedValue({
      id: 1,
      name: "Visa",
      debtType: "CREDIT_CARD",
      originalBalance: new Prisma.Decimal("1200"),
      interestRate: new Prisma.Decimal("18.99"),
      minimumPayment: null,
      startDate: null,
      targetPayoffDate: null,
      isActive: true,
      notes: null,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      debtPayments: [],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1", {
        method: "PUT",
        body: JSON.stringify({
          minimumPayment: null,
          startDate: null,
          targetPayoffDate: null,
          notes: null,
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
    expect(mockPrisma.debt.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        minimumPayment: null,
        startDate: null,
        targetPayoffDate: null,
        notes: null,
      },
      include: {
        debtPayments: {
          orderBy: {
            paymentDate: "desc",
          },
        },
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      minimumPayment: null,
      startDate: null,
      targetPayoffDate: null,
      notes: null,
    });
  });

  it("should return a 400 error when the debt id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/nope", {
        method: "PUT",
        body: JSON.stringify({
          notes: "Updated",
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
      error: "Invalid debt id",
    });
    expect(mockPrisma.debt.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the debt does not exist", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1", {
        method: "PUT",
        body: JSON.stringify({
          notes: "Updated",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Debt not found",
    });
    expect(mockPrisma.debt.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1", {
        method: "PUT",
        body: JSON.stringify({
          minimumPayment: "",
          startDate: "",
          notes: "   ",
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
    expect(mockPrisma.debt.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1", {
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

describe("[Unit] debt item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a debt when the debt exists and is inactive", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue({
      id: 1,
      isActive: false,
    });

    const response = await DELETE(new NextRequest("http://localhost/api/debts/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.debt.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the debt id is invalid", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/debts/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid debt id",
    });
    expect(mockPrisma.debt.delete).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the debt does not exist", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/debts/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Debt not found",
    });
    expect(mockPrisma.debt.delete).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the debt is active", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue({
      id: 1,
      isActive: true,
    });

    const response = await DELETE(new NextRequest("http://localhost/api/debts/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Only inactive debts can be deleted",
    });
    expect(mockPrisma.debt.delete).not.toHaveBeenCalled();
  });
});
