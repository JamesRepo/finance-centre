import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    savingsGoal: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, GET, PUT } from "@/app/api/savings/[id]/route";

describe("[Unit] savings goal item route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a savings goal with contributions and progress when the goal exists", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue({
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
          contributionDate: new Date("2026-03-10T00:00:00.000Z"),
          note: "March",
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
        },
      ],
    });

    const response = await GET(new NextRequest("http://localhost/api/savings/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.savingsGoal.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        savingsContributions: {
          orderBy: {
            contributionDate: "desc",
          },
        },
      },
    });
    expect(body).toMatchObject({
      id: 1,
      currentAmount: "250",
      progress: "25",
    });
  });

  it("should return a 400 error when the savings goal id is invalid", async () => {
    const response = await GET(new NextRequest("http://localhost/api/savings/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid savings goal id",
    });
    expect(mockPrisma.savingsGoal.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the savings goal does not exist", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/savings/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Savings goal not found",
    });
  });
});

describe("[Unit] savings goal item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a savings goal when the goal exists and the payload is valid", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValueOnce({
      id: 1,
    });
    mockPrisma.savingsGoal.update.mockResolvedValue({
      id: 1,
      name: "House Deposit",
      targetAmount: new Prisma.Decimal("15000"),
      targetDate: new Date("2026-09-01T00:00:00.000Z"),
      priority: "HIGH",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      savingsContributions: [
        {
          id: 11,
          goalId: 1,
          amount: new Prisma.Decimal("500"),
          contributionDate: new Date("2026-03-10T00:00:00.000Z"),
          note: null,
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
        },
      ],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/savings/1", {
        method: "PUT",
        body: JSON.stringify({
          name: " House Deposit ",
          targetAmount: "15000",
          targetDate: "2026-09-01T00:00:00.000Z",
          priority: "HIGH",
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
    expect(mockPrisma.savingsGoal.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "House Deposit",
        targetAmount: 15000,
        targetDate: new Date("2026-09-01T00:00:00.000Z"),
        priority: "HIGH",
      },
      include: {
        savingsContributions: {
          orderBy: {
            contributionDate: "desc",
          },
        },
      },
    });
    const body = await response.json();

    expect(body).toMatchObject({
      id: 1,
      currentAmount: "500",
    });
    expect(body.progress).toBe("3.3333333333333333333");
  });

  it("should clear nullable savings goal fields when the payload sets them to null", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValueOnce({
      id: 1,
    });
    mockPrisma.savingsGoal.update.mockResolvedValue({
      id: 1,
      name: "Emergency Fund",
      targetAmount: new Prisma.Decimal("5000"),
      targetDate: null,
      priority: null,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      savingsContributions: [],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/savings/1", {
        method: "PUT",
        body: JSON.stringify({
          targetDate: null,
          priority: null,
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
    expect(mockPrisma.savingsGoal.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        targetDate: null,
        priority: null,
      },
      include: {
        savingsContributions: {
          orderBy: {
            contributionDate: "desc",
          },
        },
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      targetDate: null,
      priority: null,
    });
  });

  it("should return a 400 error when the savings goal id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/savings/nope", {
        method: "PUT",
        body: JSON.stringify({
          name: "Updated",
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
      error: "Invalid savings goal id",
    });
    expect(mockPrisma.savingsGoal.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the savings goal does not exist", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/savings/1", {
        method: "PUT",
        body: JSON.stringify({
          name: "Updated",
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
      error: "Savings goal not found",
    });
    expect(mockPrisma.savingsGoal.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/savings/1", {
        method: "PUT",
        body: JSON.stringify({
          targetDate: "",
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
      error: "At least one field is required",
    });
    expect(mockPrisma.savingsGoal.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/savings/1", {
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

describe("[Unit] savings goal item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a savings goal when the goal exists", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue({
      id: 1,
    });

    const response = await DELETE(new NextRequest("http://localhost/api/savings/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.savingsGoal.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the savings goal id is invalid", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/savings/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid savings goal id",
    });
    expect(mockPrisma.savingsGoal.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the savings goal does not exist", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/savings/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Savings goal not found",
    });
    expect(mockPrisma.savingsGoal.delete).not.toHaveBeenCalled();
  });
});
