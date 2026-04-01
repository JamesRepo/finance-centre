import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/subscriptions/copy/route";

describe("[Unit] subscriptions copy route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should copy only subscriptions whose names do not exist in the target month", async () => {
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          name: "Spotify",
          amount: new Prisma.Decimal("9.99"),
          frequency: "MONTHLY",
          paymentDate: new Date("2026-03-20T00:00:00.000Z"),
          paymentMonth: new Date("2026-03-01T00:00:00.000Z"),
          description: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        {
          id: 2,
          name: "Netflix",
          amount: new Prisma.Decimal("120"),
          frequency: "YEARLY",
          paymentDate: new Date("2026-03-31T00:00:00.000Z"),
          paymentMonth: new Date("2026-03-01T00:00:00.000Z"),
          description: "Streaming",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([{ name: "Spotify" }]);

    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions/copy", {
        method: "POST",
        body: JSON.stringify({
          sourceMonth: "2026-03",
          targetMonth: "2026-04",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.subscription.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        paymentMonth: {
          gte: new Date("2026-03-01T00:00:00.000Z"),
          lt: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
      orderBy: [{ paymentDate: "asc" }, { name: "asc" }],
    });
    expect(mockPrisma.subscription.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        paymentMonth: {
          gte: new Date("2026-04-01T00:00:00.000Z"),
          lt: new Date("2026-05-01T00:00:00.000Z"),
        },
      },
      select: {
        name: true,
      },
    });
    expect(mockPrisma.subscription.createMany).toHaveBeenCalledWith({
      data: [
        {
          name: "Netflix",
          amount: new Prisma.Decimal("120"),
          frequency: "YEARLY",
          paymentDate: new Date("2026-04-30T00:00:00.000Z"),
          paymentMonth: new Date("2026-04-01T00:00:00.000Z"),
          description: "Streaming",
        },
      ],
    });
    expect(await response.json()).toEqual({
      copiedCount: 1,
      skippedCount: 1,
    });
  });

  it("should skip createMany when there are no subscriptions to copy", async () => {
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions/copy", {
        method: "POST",
        body: JSON.stringify({
          sourceMonth: "2026-03",
          targetMonth: "2026-04",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.subscription.createMany).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      copiedCount: 0,
      skippedCount: 0,
    });
  });

  it("should return a 400 error when the payload fails validation", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions/copy", {
        method: "POST",
        body: JSON.stringify({
          sourceMonth: "2026-3",
          targetMonth: "2026-04",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/subscriptions/copy", {
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
