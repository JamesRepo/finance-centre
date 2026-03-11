import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    debt: {
      findUnique: vi.fn(),
    },
    debtPayment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/debts/[id]/payments/route";

describe("[Unit] debt payments route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return payments ordered by paymentDate desc when the debt exists", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue({
      id: 1,
    });
    mockPrisma.debtPayment.findMany.mockResolvedValue([
      {
        id: 2,
        debtId: 1,
        amount: "50",
        paymentDate: "2026-03-10T00:00:00.000Z",
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/debts/1/payments"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.debtPayment.findMany).toHaveBeenCalledWith({
      where: { debtId: 1 },
      orderBy: {
        paymentDate: "desc",
      },
    });
    expect(await response.json()).toEqual([
      {
        id: 2,
        debtId: 1,
        amount: "50",
        paymentDate: "2026-03-10T00:00:00.000Z",
      },
    ]);
  });

  it("should return a 400 error when the debt id is invalid", async () => {
    const response = await GET(new NextRequest("http://localhost/api/debts/abc/payments"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid debt id",
    });
    expect(mockPrisma.debt.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the debt does not exist", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/debts/1/payments"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Debt not found",
    });
    expect(mockPrisma.debtPayment.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] debt payments route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a payment when the debt exists and the payload is valid", async () => {
    mockPrisma.debt.findUnique.mockResolvedValue({
      id: 1,
    });
    mockPrisma.debtPayment.create.mockResolvedValue({
      id: 4,
      debtId: 1,
      amount: "125.5",
      paymentDate: "2026-03-11T00:00:00.000Z",
      note: "March payment",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/debts/1/payments", {
        method: "POST",
        body: JSON.stringify({
          amount: "125.5",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: " March payment ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.debtPayment.create).toHaveBeenCalledWith({
      data: {
        debtId: 1,
        amount: 125.5,
        paymentDate: new Date("2026-03-11T00:00:00.000Z"),
        note: "March payment",
      },
    });
    expect(await response.json()).toEqual({
      id: 4,
      debtId: 1,
      amount: "125.5",
      paymentDate: "2026-03-11T00:00:00.000Z",
      note: "March payment",
    });
  });

  it("should return a 400 error when the debt id is invalid", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/debts/abc/payments", {
        method: "POST",
        body: JSON.stringify({
          amount: 10,
          paymentDate: "2026-03-11T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "abc" }),
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

    const response = await POST(
      new NextRequest("http://localhost/api/debts/1/payments", {
        method: "POST",
        body: JSON.stringify({
          amount: 10,
          paymentDate: "2026-03-11T00:00:00.000Z",
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
    expect(mockPrisma.debtPayment.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/debts/1/payments", {
        method: "POST",
        body: JSON.stringify({
          amount: 0,
          paymentDate: "2026-03-11T00:00:00.000Z",
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
      error: "Too small: expected number to be >0",
    });
    expect(mockPrisma.debt.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/debts/1/payments", {
        method: "POST",
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
