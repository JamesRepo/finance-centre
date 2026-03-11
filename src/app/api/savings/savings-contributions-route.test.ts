import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    savingsGoal: {
      findUnique: vi.fn(),
    },
    savingsContribution: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/savings/[id]/contributions/route";

describe("[Unit] savings contributions route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return contributions ordered by contributionDate desc when the goal exists", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue({
      id: 1,
    });
    mockPrisma.savingsContribution.findMany.mockResolvedValue([
      {
        id: 2,
        goalId: 1,
        amount: "50",
        contributionDate: "2026-03-10T00:00:00.000Z",
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/savings/1/contributions"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.savingsContribution.findMany).toHaveBeenCalledWith({
      where: { goalId: 1 },
      orderBy: {
        contributionDate: "desc",
      },
    });
    expect(await response.json()).toEqual([
      {
        id: 2,
        goalId: 1,
        amount: "50",
        contributionDate: "2026-03-10T00:00:00.000Z",
      },
    ]);
  });

  it("should return a 400 error when the savings goal id is invalid", async () => {
    const response = await GET(new NextRequest("http://localhost/api/savings/abc/contributions"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid savings goal id",
    });
    expect(mockPrisma.savingsGoal.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the savings goal does not exist", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/savings/1/contributions"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Savings goal not found",
    });
    expect(mockPrisma.savingsContribution.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] savings contributions route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a contribution when the goal exists and the payload is valid", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue({
      id: 1,
    });
    mockPrisma.savingsContribution.create.mockResolvedValue({
      id: 4,
      goalId: 1,
      amount: "125.5",
      contributionDate: "2026-03-11T00:00:00.000Z",
      note: "Pay day",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/savings/1/contributions", {
        method: "POST",
        body: JSON.stringify({
          amount: "125.5",
          contributionDate: "2026-03-11T00:00:00.000Z",
          note: " Pay day ",
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
    expect(mockPrisma.savingsContribution.create).toHaveBeenCalledWith({
      data: {
        goalId: 1,
        amount: 125.5,
        contributionDate: new Date("2026-03-11T00:00:00.000Z"),
        note: "Pay day",
      },
    });
    expect(await response.json()).toEqual({
      id: 4,
      goalId: 1,
      amount: "125.5",
      contributionDate: "2026-03-11T00:00:00.000Z",
      note: "Pay day",
    });
  });

  it("should return a 400 error when the savings goal id is invalid", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/savings/abc/contributions", {
        method: "POST",
        body: JSON.stringify({
          amount: 10,
          contributionDate: "2026-03-11T00:00:00.000Z",
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
      error: "Invalid savings goal id",
    });
    expect(mockPrisma.savingsGoal.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the savings goal does not exist", async () => {
    mockPrisma.savingsGoal.findUnique.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/savings/1/contributions", {
        method: "POST",
        body: JSON.stringify({
          amount: 10,
          contributionDate: "2026-03-11T00:00:00.000Z",
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
    expect(mockPrisma.savingsContribution.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/savings/1/contributions", {
        method: "POST",
        body: JSON.stringify({
          amount: 0,
          contributionDate: "2026-03-11T00:00:00.000Z",
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
    expect(mockPrisma.savingsGoal.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/savings/1/contributions", {
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
