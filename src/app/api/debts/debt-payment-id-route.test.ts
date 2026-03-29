import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    debtPayment: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, PUT } from "@/app/api/debts/[id]/payments/[paymentId]/route";

describe("[Unit] debt payment item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a payment when it belongs to the specified debt", async () => {
    mockPrisma.debtPayment.findFirst.mockResolvedValue({
      id: 4,
      debtId: 1,
    });
    mockPrisma.debtPayment.update.mockResolvedValue({
      id: 4,
      debtId: 1,
      amount: "95.25",
      interestAmount: "15.25",
      paymentDate: "2026-03-15T00:00:00.000Z",
      note: "Updated payment",
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1/payments/4", {
        method: "PUT",
        body: JSON.stringify({
          amount: "95.25",
          interestAmount: "15.25",
          paymentDate: "2026-03-15T00:00:00.000Z",
          note: " Updated payment ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.debtPayment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 4,
        debtId: 1,
      },
    });
    expect(mockPrisma.debtPayment.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        amount: 95.25,
        interestAmount: 15.25,
        paymentDate: new Date("2026-03-15T00:00:00.000Z"),
        note: "Updated payment",
      },
    });
    expect(await response.json()).toEqual({
      id: 4,
      debtId: 1,
      amount: "95.25",
      interestAmount: "15.25",
      paymentDate: "2026-03-15T00:00:00.000Z",
      note: "Updated payment",
    });
  });

  it("should clear the note when the update payload sends null", async () => {
    mockPrisma.debtPayment.findFirst.mockResolvedValue({
      id: 4,
      debtId: 1,
      note: "Existing note",
    });
    mockPrisma.debtPayment.update.mockResolvedValue({
      id: 4,
      debtId: 1,
      amount: "95.25",
      interestAmount: "15.25",
      paymentDate: "2026-03-15T00:00:00.000Z",
      note: null,
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1/payments/4", {
        method: "PUT",
        body: JSON.stringify({
          amount: "95.25",
          interestAmount: "15.25",
          paymentDate: "2026-03-15T00:00:00.000Z",
          note: null,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.debtPayment.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        amount: 95.25,
        interestAmount: 15.25,
        paymentDate: new Date("2026-03-15T00:00:00.000Z"),
        note: null,
      },
    });
    expect(await response.json()).toEqual({
      id: 4,
      debtId: 1,
      amount: "95.25",
      interestAmount: "15.25",
      paymentDate: "2026-03-15T00:00:00.000Z",
      note: null,
    });
  });

  it("should return a 400 error when the debt id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/nope/payments/4", {
        method: "PUT",
        body: JSON.stringify({
          amount: 25,
          paymentDate: "2026-03-15T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "nope", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid debt id",
    });
    expect(mockPrisma.debtPayment.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the payment id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1/payments/nope", {
        method: "PUT",
        body: JSON.stringify({
          amount: 25,
          paymentDate: "2026-03-15T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", paymentId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid payment id",
    });
    expect(mockPrisma.debtPayment.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the payment does not belong to the debt", async () => {
    mockPrisma.debtPayment.findFirst.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1/payments/999", {
        method: "PUT",
        body: JSON.stringify({
          amount: 25,
          paymentDate: "2026-03-15T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", paymentId: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Payment not found",
    });
    expect(mockPrisma.debtPayment.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when amount is not positive", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1/payments/4", {
        method: "PUT",
        body: JSON.stringify({
          amount: 0,
          paymentDate: "2026-03-15T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Too small: expected number to be >0",
    });
    expect(mockPrisma.debtPayment.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when paymentDate is missing", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1/payments/4", {
        method: "PUT",
        body: JSON.stringify({
          amount: 25,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid input: expected date, received Date",
    });
    expect(mockPrisma.debtPayment.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/debts/1/payments/4", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});

describe("[Unit] debt payment item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a payment when it belongs to the specified debt", async () => {
    mockPrisma.debtPayment.findFirst.mockResolvedValue({
      id: 4,
      debtId: 1,
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/debts/1/payments/4"),
      {
        params: Promise.resolve({ id: "1", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(204);
    expect(mockPrisma.debtPayment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 4,
        debtId: 1,
      },
    });
    expect(mockPrisma.debtPayment.delete).toHaveBeenCalledWith({
      where: { id: 4 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the debt id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/debts/nope/payments/4"),
      {
        params: Promise.resolve({ id: "nope", paymentId: "4" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid debt id",
    });
    expect(mockPrisma.debtPayment.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the payment id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/debts/1/payments/nope"),
      {
        params: Promise.resolve({ id: "1", paymentId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid payment id",
    });
    expect(mockPrisma.debtPayment.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the payment does not belong to the debt", async () => {
    mockPrisma.debtPayment.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("http://localhost/api/debts/1/payments/999"),
      {
        params: Promise.resolve({ id: "1", paymentId: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Payment not found",
    });
    expect(mockPrisma.debtPayment.delete).not.toHaveBeenCalled();
  });
});
