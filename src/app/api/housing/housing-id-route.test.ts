import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    housingExpense: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, PUT } from "@/app/api/housing/[id]/route";

describe("[Unit] housing item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a housing expense when the id and payload are valid", async () => {
    mockPrisma.housingExpense.findUnique.mockResolvedValue({
      id: 1,
      expenseType: "ENERGY",
      amount: new Prisma.Decimal("125.50"),
      expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
      frequency: "MONTHLY",
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
    });
    mockPrisma.housingExpense.findFirst.mockResolvedValue(null);
    mockPrisma.housingExpense.update.mockResolvedValue({
      id: 1,
      expenseType: "WATER",
      amount: new Prisma.Decimal("90"),
      expenseMonth: new Date("2026-04-01T00:00:00.000Z"),
      frequency: "YEARLY",
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/housing/1", {
        method: "PUT",
        body: JSON.stringify({
          expenseType: "WATER",
          month: "2026-04",
          amount: "90.00",
          frequency: "YEARLY",
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
    expect(mockPrisma.housingExpense.findFirst).toHaveBeenCalledWith({
      where: {
        expenseType: "WATER",
        expenseMonth: new Date("2026-04-01T00:00:00.000Z"),
        id: {
          not: 1,
        },
      },
    });
    expect(mockPrisma.housingExpense.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        expenseType: "WATER",
        amount: 90,
        expenseMonth: new Date("2026-04-01T00:00:00.000Z"),
        frequency: "YEARLY",
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      expenseType: "WATER",
      amount: "90",
      frequency: "YEARLY",
    });
  });

  it("should return a 400 error when the housing expense id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/housing/nope", {
        method: "PUT",
        body: JSON.stringify({
          amount: 100,
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
      error: "Invalid housing expense id",
    });
    expect(mockPrisma.housingExpense.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the housing expense does not exist", async () => {
    mockPrisma.housingExpense.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/housing/999", {
        method: "PUT",
        body: JSON.stringify({
          amount: 100,
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
      error: "Housing expense not found",
    });
    expect(mockPrisma.housingExpense.update).not.toHaveBeenCalled();
  });

  it("should return a 409 error when updating would duplicate another type and month", async () => {
    mockPrisma.housingExpense.findUnique.mockResolvedValue({
      id: 1,
      expenseType: "ENERGY",
      amount: new Prisma.Decimal("125.50"),
      expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
      frequency: "MONTHLY",
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
    });
    mockPrisma.housingExpense.findFirst.mockResolvedValue({
      id: 9,
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/housing/1", {
        method: "PUT",
        body: JSON.stringify({
          expenseType: "WATER",
          month: "2026-04",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Housing expense already exists for this type and month",
    });
    expect(mockPrisma.housingExpense.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/housing/1", {
        method: "PUT",
        body: JSON.stringify({}),
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
    expect(mockPrisma.housingExpense.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/housing/1", {
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

describe("[Unit] housing item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a housing expense when the housing expense exists", async () => {
    mockPrisma.housingExpense.findUnique.mockResolvedValue({
      id: 1,
    });

    const response = await DELETE(new NextRequest("http://localhost/api/housing/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.housingExpense.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the housing expense id is invalid", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/housing/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid housing expense id",
    });
    expect(mockPrisma.housingExpense.delete).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the housing expense does not exist", async () => {
    mockPrisma.housingExpense.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/housing/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Housing expense not found",
    });
    expect(mockPrisma.housingExpense.delete).not.toHaveBeenCalled();
  });
});
