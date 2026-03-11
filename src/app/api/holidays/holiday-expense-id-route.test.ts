import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    holidayExpense: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, PUT } from "@/app/api/holidays/[id]/expenses/[expenseId]/route";

describe("[Unit] holiday expense item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update an expense when it belongs to the specified holiday", async () => {
    mockPrisma.holidayExpense.findFirst.mockResolvedValue({
      id: 8,
      holidayId: 5,
    });
    mockPrisma.holidayExpense.update.mockResolvedValue({
      id: 8,
      holidayId: 5,
      expenseType: "FOOD",
      description: "Dinner",
      amount: "55.25",
      expenseDate: "2026-07-18T00:00:00.000Z",
      notes: null,
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/5/expenses/8", {
        method: "PUT",
        body: JSON.stringify({
          description: " Dinner ",
          amount: "55.25",
          notes: null,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5", expenseId: "8" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.holidayExpense.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: {
        description: "Dinner",
        amount: 55.25,
        notes: null,
      },
    });
    expect(await response.json()).toEqual({
      id: 8,
      holidayId: 5,
      expenseType: "FOOD",
      description: "Dinner",
      amount: "55.25",
      expenseDate: "2026-07-18T00:00:00.000Z",
      notes: null,
    });
  });

  it("should return a 400 error when the holiday id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/nope/expenses/8", {
        method: "PUT",
        body: JSON.stringify({
          description: "Dinner",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "nope", expenseId: "8" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid holiday id",
    });
    expect(mockPrisma.holidayExpense.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the expense id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/5/expenses/nope", {
        method: "PUT",
        body: JSON.stringify({
          description: "Dinner",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5", expenseId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid expense id",
    });
    expect(mockPrisma.holidayExpense.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the expense does not belong to the holiday", async () => {
    mockPrisma.holidayExpense.findFirst.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/5/expenses/999", {
        method: "PUT",
        body: JSON.stringify({
          description: "Dinner",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5", expenseId: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Expense not found",
    });
    expect(mockPrisma.holidayExpense.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/5/expenses/8", {
        method: "PUT",
        body: JSON.stringify({
          notes: "   ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5", expenseId: "8" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field is required",
    });
    expect(mockPrisma.holidayExpense.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/5/expenses/8", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5", expenseId: "8" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});

describe("[Unit] holiday expense item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete an expense when it belongs to the specified holiday", async () => {
    mockPrisma.holidayExpense.findFirst.mockResolvedValue({
      id: 8,
      holidayId: 5,
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/holidays/5/expenses/8"),
      {
        params: Promise.resolve({ id: "5", expenseId: "8" }),
      },
    );

    expect(response.status).toBe(204);
    expect(mockPrisma.holidayExpense.delete).toHaveBeenCalledWith({
      where: { id: 8 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the holiday id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/holidays/nope/expenses/8"),
      {
        params: Promise.resolve({ id: "nope", expenseId: "8" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid holiday id",
    });
    expect(mockPrisma.holidayExpense.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the expense id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/holidays/5/expenses/nope"),
      {
        params: Promise.resolve({ id: "5", expenseId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid expense id",
    });
    expect(mockPrisma.holidayExpense.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the expense does not belong to the holiday", async () => {
    mockPrisma.holidayExpense.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("http://localhost/api/holidays/5/expenses/999"),
      {
        params: Promise.resolve({ id: "5", expenseId: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Expense not found",
    });
    expect(mockPrisma.holidayExpense.delete).not.toHaveBeenCalled();
  });
});
