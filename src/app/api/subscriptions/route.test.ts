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

function createKnownRequestError(code: string) {
  return Object.assign(
    Object.create(Prisma.PrismaClientKnownRequestError.prototype),
    { code },
  );
}

describe("[Unit] subscriptions collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return month-filtered subscriptions with totals when the query month is valid", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      {
        id: 1,
        name: "Annual Prime",
        amount: new Prisma.Decimal("120"),
        frequency: "YEARLY",
        paymentDate: new Date("2026-03-05T00:00:00.000Z"),
        paymentMonth: new Date("2026-03-01T00:00:00.000Z"),
        description: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        id: 2,
        name: "Netflix",
        amount: new Prisma.Decimal("15.99"),
        frequency: "MONTHLY",
        paymentDate: new Date("2026-03-20T00:00:00.000Z"),
        paymentMonth: new Date("2026-03-01T00:00:00.000Z"),
        description: "Streaming",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/subscriptions?month=2026-03"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        paymentMonth: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
      orderBy: [{ paymentDate: "asc" }, { name: "asc" }],
    });
    expect(body).toEqual({
      month: "2026-03",
      subscriptions: [
        expect.objectContaining({
          id: 1,
          monthlyEquivalent: "10",
        }),
        expect.objectContaining({
          id: 2,
          monthlyEquivalent: "15.99",
        }),
      ],
      total: "135.99",
      monthlyEquivalentTotal: "25.99",
    });
  });

  it("should default to the current month when the month query is missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00.000Z"));
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost/api/subscriptions"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        paymentMonth: {
          gte: new Date("2026-04-01T00:00:00.000Z"),
          lt: new Date("2026-05-01T00:00:00.000Z"),
        },
      },
      orderBy: [{ paymentDate: "asc" }, { name: "asc" }],
    });
    expect(body).toEqual({
      month: "2026-04",
      subscriptions: [],
      total: "0",
      monthlyEquivalentTotal: "0",
    });
    vi.useRealTimers();
  });

  it("should return a 400 error when the month query is invalid", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/subscriptions?month=2026-3"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.subscription.findMany).not.toHaveBeenCalled();
  });
});

describe("[Unit] subscriptions collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a subscription for the requested month when the payload is valid", async () => {
    mockPrisma.subscription.create.mockResolvedValue({
      id: 1,
      name: "Spotify",
      amount: new Prisma.Decimal("9.99"),
      frequency: "MONTHLY",
      paymentDate: new Date("2026-04-21T00:00:00.000Z"),
      paymentMonth: new Date("2026-04-01T00:00:00.000Z"),
      description: "Music",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: " Spotify ",
          amount: "9.99",
          frequency: "MONTHLY",
          month: "2026-04",
          paymentDate: "2026-04-21T00:00:00.000Z",
          description: " Music ",
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
        paymentDate: new Date("2026-04-21T00:00:00.000Z"),
        paymentMonth: new Date("2026-04-01T00:00:00.000Z"),
        description: "Music",
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      monthlyEquivalent: "9.99",
    });
  });

  it("should return a 400 error when the payment date falls outside the selected month", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: "Spotify",
          amount: "9.99",
          frequency: "MONTHLY",
          month: "2026-04",
          paymentDate: "2026-05-01T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Payment date must be within the selected month",
    });
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
  });

  it("should return a 409 error when a subscription already exists for the month", async () => {
    mockPrisma.subscription.create.mockRejectedValue(createKnownRequestError("P2002"));

    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: "Spotify",
          amount: "9.99",
          frequency: "MONTHLY",
          month: "2026-04",
          paymentDate: "2026-04-21T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Subscription already exists for this month",
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
          month: "2026-04",
          paymentDate: "2026-04-21T00:00:00.000Z",
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
