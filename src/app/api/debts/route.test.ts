import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    debt: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/debts/route";

describe("[Unit] debts collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return debts with computed balances when debts exist", async () => {
    mockPrisma.debt.findMany.mockResolvedValue([
      {
        id: 1,
        name: "Visa",
        debtType: "CREDIT_CARD",
        originalBalance: new Prisma.Decimal("1000"),
        interestRate: new Prisma.Decimal("19.99"),
        minimumPayment: new Prisma.Decimal("35"),
        startDate: null,
        targetPayoffDate: null,
        isActive: true,
        notes: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        debtPayments: [
          {
            id: 11,
            debtId: 1,
            amount: new Prisma.Decimal("100.25"),
            paymentDate: new Date("2026-03-05T00:00:00.000Z"),
            note: null,
            createdAt: new Date("2026-03-05T00:00:00.000Z"),
          },
          {
            id: 12,
            debtId: 1,
            amount: new Prisma.Decimal("99.75"),
            paymentDate: new Date("2026-02-05T00:00:00.000Z"),
            note: null,
            createdAt: new Date("2026-02-05T00:00:00.000Z"),
          },
        ],
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.debt.findMany).toHaveBeenCalledWith({
      include: {
        debtPayments: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    expect(body).toEqual([
      expect.objectContaining({
        id: 1,
        name: "Visa",
        totalPaid: "200",
        paymentCount: 2,
        currentBalance: "800",
      }),
    ]);
  });
});

describe("[Unit] debts collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a debt when the payload is valid", async () => {
    mockPrisma.debt.create.mockResolvedValue({
      id: 1,
      name: "Visa Card",
      debtType: "CREDIT_CARD",
      originalBalance: new Prisma.Decimal("2500.75"),
      interestRate: new Prisma.Decimal("19.99"),
      minimumPayment: new Prisma.Decimal("50"),
      startDate: new Date("2026-01-15T00:00:00.000Z"),
      targetPayoffDate: null,
      isActive: true,
      notes: "Main card",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      debtPayments: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/debts", {
        method: "POST",
        body: JSON.stringify({
          name: " Visa Card ",
          debtType: "CREDIT_CARD",
          originalBalance: "2500.75",
          interestRate: "19.99",
          minimumPayment: "50",
          startDate: "2026-01-15T00:00:00.000Z",
          isActive: true,
          notes: " Main card ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.debt.create).toHaveBeenCalledWith({
      data: {
        name: "Visa Card",
        debtType: "CREDIT_CARD",
        originalBalance: 2500.75,
        interestRate: 19.99,
        minimumPayment: 50,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        targetPayoffDate: undefined,
        isActive: true,
        notes: "Main card",
      },
      include: {
        debtPayments: true,
      },
    });
    expect(body).toMatchObject({
      id: 1,
      name: "Visa Card",
      totalPaid: "0",
      paymentCount: 0,
      currentBalance: "2500.75",
    });
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/debts", {
        method: "POST",
        body: JSON.stringify({
          name: "Loan",
          debtType: "OTHER",
          originalBalance: 0,
          interestRate: 2,
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
    expect(mockPrisma.debt.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/debts", {
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
