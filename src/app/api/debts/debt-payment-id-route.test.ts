import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    debtPayment: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE } from "@/app/api/debts/[id]/payments/[paymentId]/route";

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
