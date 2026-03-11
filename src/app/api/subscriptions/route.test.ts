import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/subscriptions/route";

describe("[Unit] subscriptions collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return subscriptions ordered by active status and name with monthlyEquivalent", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      {
        id: 1,
        name: "Annual Prime",
        amount: new Prisma.Decimal("120"),
        frequency: "YEARLY",
        nextPaymentDate: new Date("2027-01-01T00:00:00.000Z"),
        description: null,
        isActive: true,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        id: 2,
        name: "Netflix",
        amount: new Prisma.Decimal("15.99"),
        frequency: "MONTHLY",
        nextPaymentDate: new Date("2026-04-01T00:00:00.000Z"),
        description: "Streaming",
        isActive: false,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    expect(body).toEqual([
      expect.objectContaining({
        id: 1,
        monthlyEquivalent: "10",
      }),
      expect.objectContaining({
        id: 2,
        monthlyEquivalent: "15.99",
      }),
    ]);
  });
});

describe("[Unit] subscriptions collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a subscription when the payload is valid", async () => {
    mockPrisma.subscription.create.mockResolvedValue({
      id: 1,
      name: "Spotify",
      amount: new Prisma.Decimal("9.99"),
      frequency: "MONTHLY",
      nextPaymentDate: new Date("2026-04-01T00:00:00.000Z"),
      description: "Music",
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: " Spotify ",
          amount: "9.99",
          frequency: "MONTHLY",
          nextPaymentDate: "2026-04-01T00:00:00.000Z",
          description: " Music ",
          isActive: true,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
      data: {
        name: "Spotify",
        amount: 9.99,
        frequency: "MONTHLY",
        nextPaymentDate: new Date("2026-04-01T00:00:00.000Z"),
        description: "Music",
        isActive: true,
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      monthlyEquivalent: "9.99",
    });
  });

  it("should return a 400 error when the payload fails validation", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: "Spotify",
          amount: 0,
          frequency: "MONTHLY",
          nextPaymentDate: "2026-04-01T00:00:00.000Z",
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
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions", {
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
