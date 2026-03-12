import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    holiday: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/holidays/route";

describe("[Unit] holidays collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return holidays with totalCost and expenseCount when holidays exist", async () => {
    mockPrisma.holiday.findMany.mockResolvedValue([
      {
        id: 2,
        name: "Barcelona",
        destination: "Spain",
        startDate: new Date("2026-08-05T00:00:00.000Z"),
        endDate: new Date("2026-08-12T00:00:00.000Z"),
        description: "Summer break",
        isActive: true,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        holidayExpenses: [
          {
            expenseType: "FOOD",
            amount: new Prisma.Decimal("79.50"),
          },
          {
            expenseType: "FLIGHT",
            amount: new Prisma.Decimal("120.50"),
          },
          {
            expenseType: "FLIGHT",
            amount: new Prisma.Decimal("20.00"),
          },
        ],
        _count: {
          holidayExpenses: 3,
        },
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.holiday.findMany).toHaveBeenCalledWith({
      include: {
        holidayExpenses: {
          select: {
            expenseType: true,
            amount: true,
          },
        },
        _count: {
          select: {
            holidayExpenses: true,
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });
    expect(body).toEqual([
      expect.objectContaining({
        id: 2,
        totalCost: "220",
        expenseCount: 3,
        expenseBreakdown: [
          {
            expenseType: "FLIGHT",
            totalCost: "140.5",
          },
          {
            expenseType: "FOOD",
            totalCost: "79.5",
          },
        ],
      }),
    ]);
    expect(body[0]).not.toHaveProperty("holidayExpenses");
    expect(body[0]).not.toHaveProperty("_count");
  });
});

describe("[Unit] holidays collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a holiday when the payload is valid", async () => {
    mockPrisma.holiday.create.mockResolvedValue({
      id: 3,
      name: "Rome",
      destination: "Italy",
      startDate: new Date("2026-09-10T00:00:00.000Z"),
      endDate: new Date("2026-09-14T00:00:00.000Z"),
      description: "City break",
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      holidayExpenses: [],
      _count: {
        holidayExpenses: 0,
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/holidays", {
        method: "POST",
        body: JSON.stringify({
          name: " Rome ",
          destination: " Italy ",
          startDate: "2026-09-10T00:00:00.000Z",
          endDate: "2026-09-14T00:00:00.000Z",
          description: " City break ",
          isActive: true,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.holiday.create).toHaveBeenCalledWith({
      data: {
        name: "Rome",
        destination: "Italy",
        startDate: new Date("2026-09-10T00:00:00.000Z"),
        endDate: new Date("2026-09-14T00:00:00.000Z"),
        description: "City break",
        isActive: true,
      },
      include: {
        holidayExpenses: {
          select: {
            expenseType: true,
            amount: true,
          },
        },
        _count: {
          select: {
            holidayExpenses: true,
          },
        },
      },
    });
    expect(body).toMatchObject({
      id: 3,
      name: "Rome",
      totalCost: "0",
      expenseCount: 0,
      expenseBreakdown: [],
    });
    expect(body).not.toHaveProperty("holidayExpenses");
    expect(body).not.toHaveProperty("_count");
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/holidays", {
        method: "POST",
        body: JSON.stringify({
          name: "Trip",
          destination: "Paris",
          startDate: "2026-09-14T00:00:00.000Z",
          endDate: "2026-09-10T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "End date must be on or after start date",
    });
    expect(mockPrisma.holiday.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/holidays", {
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
