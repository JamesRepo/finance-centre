import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    savingsGoal: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/savings/route";

describe("[Unit] savings collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return savings goals with computed progress ordered by priority when goals exist", async () => {
    mockPrisma.savingsGoal.findMany.mockResolvedValue([
      {
        id: 2,
        name: "Holiday",
        targetAmount: new Prisma.Decimal("2000"),
        targetDate: null,
        priority: "LOW",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        savingsContributions: [
          {
            id: 21,
            goalId: 2,
            amount: new Prisma.Decimal("100"),
            contributionDate: new Date("2026-03-01T00:00:00.000Z"),
            note: null,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        ],
      },
      {
        id: 1,
        name: "Emergency Fund",
        targetAmount: new Prisma.Decimal("1000"),
        targetDate: null,
        priority: "HIGH",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        savingsContributions: [
          {
            id: 11,
            goalId: 1,
            amount: new Prisma.Decimal("250"),
            contributionDate: new Date("2026-03-05T00:00:00.000Z"),
            note: null,
            createdAt: new Date("2026-03-05T00:00:00.000Z"),
          },
          {
            id: 12,
            goalId: 1,
            amount: new Prisma.Decimal("125"),
            contributionDate: new Date("2026-03-03T00:00:00.000Z"),
            note: null,
            createdAt: new Date("2026-03-03T00:00:00.000Z"),
          },
        ],
      },
      {
        id: 3,
        name: "Buffer",
        targetAmount: new Prisma.Decimal("500"),
        targetDate: null,
        priority: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        savingsContributions: [],
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.savingsGoal.findMany).toHaveBeenCalledWith({
      include: {
        savingsContributions: true,
      },
    });
    expect(body.map((goal: { id: number }) => goal.id)).toEqual([1, 2, 3]);
    expect(body[0]).toEqual(
      expect.objectContaining({
        id: 1,
        currentAmount: "375",
        progress: "37.5",
      }),
    );
    expect(body[2]).toEqual(
      expect.objectContaining({
        id: 3,
        currentAmount: "0",
        progress: "0",
      }),
    );
  });
});

describe("[Unit] savings collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a savings goal when the payload is valid", async () => {
    mockPrisma.savingsGoal.create.mockResolvedValue({
      id: 1,
      name: "Emergency Fund",
      targetAmount: new Prisma.Decimal("5000"),
      targetDate: new Date("2026-12-31T00:00:00.000Z"),
      priority: "MEDIUM",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      savingsContributions: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/savings", {
        method: "POST",
        body: JSON.stringify({
          name: " Emergency Fund ",
          targetAmount: "5000",
          targetDate: "2026-12-31T00:00:00.000Z",
          priority: "MEDIUM",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.savingsGoal.create).toHaveBeenCalledWith({
      data: {
        name: "Emergency Fund",
        targetAmount: 5000,
        targetDate: new Date("2026-12-31T00:00:00.000Z"),
        priority: "MEDIUM",
      },
      include: {
        savingsContributions: true,
      },
    });
    expect(body).toMatchObject({
      id: 1,
      currentAmount: "0",
      progress: "0",
    });
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/savings", {
        method: "POST",
        body: JSON.stringify({
          name: "Goal",
          targetAmount: 0,
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
    expect(mockPrisma.savingsGoal.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/savings", {
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
