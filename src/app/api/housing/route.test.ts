import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    housingExpense: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/housing/route";

describe("[Unit] housing collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should return housing expenses for the requested month", async () => {
    mockPrisma.housingExpense.findMany.mockResolvedValue([
      {
        id: 1,
        expenseType: "ENERGY",
        amount: new Prisma.Decimal("125.50"),
        expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
        frequency: "MONTHLY",
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/housing?month=2026-03"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.housingExpense.findMany).toHaveBeenCalledWith({
      where: {
        expenseMonth: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
      orderBy: {
        expenseType: "asc",
      },
    });
    expect(body).toMatchObject([
      {
        id: 1,
        expenseType: "ENERGY",
        amount: "125.5",
      },
    ]);
  });

  it("should default to the current UTC month when month is omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    mockPrisma.housingExpense.findMany.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost/api/housing"));

    expect(response.status).toBe(200);
    expect(mockPrisma.housingExpense.findMany).toHaveBeenCalledWith({
      where: {
        expenseMonth: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
      orderBy: {
        expenseType: "asc",
      },
    });
  });

  it("should return a 400 error when the month query is malformed", async () => {
    const response = await GET(new NextRequest("http://localhost/api/housing?month=2026-3"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.housingExpense.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] housing collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should atomically upsert a housing expense for the type and month combo", async () => {
    mockPrisma.housingExpense.upsert.mockResolvedValue({
      id: 1,
      expenseType: "RENT",
      amount: new Prisma.Decimal("950"),
      expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
      frequency: "MONTHLY",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/housing", {
        method: "POST",
        body: JSON.stringify({
          expenseType: "RENT",
          month: "2026-03",
          amount: "950.00",
          frequency: "MONTHLY",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.housingExpense.upsert).toHaveBeenCalledWith({
      where: {
        expenseType_expenseMonth: {
          expenseType: "RENT",
          expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
        },
      },
      update: {
        amount: 950,
        frequency: "MONTHLY",
      },
      create: {
        expenseType: "RENT",
        amount: 950,
        expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
        frequency: "MONTHLY",
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      amount: "950",
    });
  });

  it("should update the amount and frequency through the upsert update branch", async () => {
    mockPrisma.housingExpense.upsert.mockResolvedValue({
      id: 7,
      expenseType: "ENERGY",
      amount: new Prisma.Decimal("140"),
      expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
      frequency: "MONTHLY",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/housing", {
        method: "POST",
        body: JSON.stringify({
          expenseType: "ENERGY",
          month: "2026-03",
          amount: 140,
          frequency: "MONTHLY",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.housingExpense.upsert).toHaveBeenCalledWith({
      where: {
        expenseType_expenseMonth: {
          expenseType: "ENERGY",
          expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
        },
      },
      update: {
        amount: 140,
        frequency: "MONTHLY",
      },
      create: {
        expenseType: "ENERGY",
        amount: 140,
        expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
        frequency: "MONTHLY",
      },
    });
  });

  it("should return a 400 error when the payload fails validation", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/housing", {
        method: "POST",
        body: JSON.stringify({
          expenseType: "RENT",
          month: "2026-03",
          amount: 0,
          frequency: "MONTHLY",
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
    expect(mockPrisma.housingExpense.upsert).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/housing", {
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
