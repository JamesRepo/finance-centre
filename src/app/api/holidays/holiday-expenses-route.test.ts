import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    holiday: {
      findUnique: vi.fn(),
    },
    holidayExpense: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/holidays/[id]/expenses/route";

describe("[Unit] holiday expenses route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return expenses ordered by expenseDate asc when the holiday exists", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue({
      id: 5,
    });
    mockPrisma.holidayExpense.findMany.mockResolvedValue([
      {
        id: 2,
        holidayId: 5,
        expenseType: "FOOD",
        description: "Lunch",
        amount: "18.5",
        expenseDate: "2026-07-16T00:00:00.000Z",
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/holidays/5/expenses"), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.holidayExpense.findMany).toHaveBeenCalledWith({
      where: { holidayId: 5 },
      orderBy: {
        expenseDate: "asc",
      },
    });
    expect(await response.json()).toEqual([
      {
        id: 2,
        holidayId: 5,
        expenseType: "FOOD",
        description: "Lunch",
        amount: "18.5",
        expenseDate: "2026-07-16T00:00:00.000Z",
      },
    ]);
  });

  it("should return a 400 error when the holiday id is invalid", async () => {
    const response = await GET(new NextRequest("http://localhost/api/holidays/nope/expenses"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid holiday id",
    });
    expect(mockPrisma.holiday.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the holiday does not exist", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/holidays/5/expenses"), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Holiday not found",
    });
    expect(mockPrisma.holidayExpense.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] holiday expenses route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an expense when the holiday exists and the payload is valid", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue({
      id: 5,
    });
    mockPrisma.holidayExpense.create.mockResolvedValue({
      id: 4,
      holidayId: 5,
      expenseType: "FLIGHT",
      description: "Return flights",
      amount: "245.5",
      expenseDate: "2026-07-15T00:00:00.000Z",
      notes: "Booked early",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/holidays/5/expenses", {
        method: "POST",
        body: JSON.stringify({
          expenseType: "FLIGHT",
          description: " Return flights ",
          amount: "245.5",
          expenseDate: "2026-07-15T00:00:00.000Z",
          notes: " Booked early ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5" }),
      },
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.holidayExpense.create).toHaveBeenCalledWith({
      data: {
        holidayId: 5,
        expenseType: "FLIGHT",
        description: "Return flights",
        amount: 245.5,
        expenseDate: new Date("2026-07-15T00:00:00.000Z"),
        notes: "Booked early",
      },
    });
    expect(await response.json()).toEqual({
      id: 4,
      holidayId: 5,
      expenseType: "FLIGHT",
      description: "Return flights",
      amount: "245.5",
      expenseDate: "2026-07-15T00:00:00.000Z",
      notes: "Booked early",
    });
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/holidays/5/expenses", {
        method: "POST",
        body: JSON.stringify({
          expenseType: "VISA",
          description: "Travel visa",
          amount: 50,
          expenseDate: "2026-07-15T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid option: expected one of \"FLIGHT\"|\"ACCOMMODATION\"|\"FOOD\"|\"TRANSPORT\"|\"ACTIVITY\"|\"SHOPPING\"|\"OTHER\"",
    });
    expect(mockPrisma.holiday.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the holiday id is invalid", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/holidays/nope/expenses", {
        method: "POST",
        body: JSON.stringify({
          expenseType: "FOOD",
          description: "Lunch",
          amount: 10,
          expenseDate: "2026-07-15T00:00:00.000Z",
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
      error: "Invalid holiday id",
    });
    expect(mockPrisma.holiday.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the holiday does not exist", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/holidays/5/expenses", {
        method: "POST",
        body: JSON.stringify({
          expenseType: "FOOD",
          description: "Lunch",
          amount: 10,
          expenseDate: "2026-07-15T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Holiday not found",
    });
    expect(mockPrisma.holidayExpense.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/holidays/5/expenses", {
        method: "POST",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "5" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});
