import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/transactions/vendors/route";

describe("[Unit] transaction vendors route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return unique vendors ordered by most recent usage", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { vendor: "Tesco" },
      { vendor: "tesco" },
      { vendor: "Pret" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/vendors"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(["Tesco", "Pret"]);
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        vendor: {
          not: null,
        },
      },
      select: {
        vendor: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
      skip: 0,
      take: 100,
    });
  });

  it("should filter by the search query when provided", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([{ vendor: "Trainline" }]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/vendors?q=train"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(["Trainline"]);
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        vendor: {
          not: null,
          contains: "train",
          mode: "insensitive",
        },
      },
      select: {
        vendor: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
      skip: 0,
      take: 100,
    });
  });

  it("should exclude blank vendors and respect the requested limit", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { vendor: " " },
      { vendor: "Tesco" },
      { vendor: "Pret" },
      { vendor: "Amazon" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/vendors?limit=2"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(["Tesco", "Pret"]);
  });

  it("should continue reading older batches until the unique vendor limit is satisfied", async () => {
    mockPrisma.transaction.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, () => ({
          vendor: "Tesco",
        })),
      )
      .mockResolvedValueOnce([
        { vendor: "Pret" },
        { vendor: "Amazon" },
      ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions/vendors?limit=3"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(["Tesco", "Pret", "Amazon"]);
    expect(mockPrisma.transaction.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        vendor: {
          not: null,
        },
      },
      select: {
        vendor: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
      skip: 0,
      take: 100,
    });
    expect(mockPrisma.transaction.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        vendor: {
          not: null,
        },
      },
      select: {
        vendor: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
      skip: 100,
      take: 100,
    });
  });

  it("should return a 400 error when limit is invalid", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions/vendors?limit=0"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Too small: expected number to be >0",
    });
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
  });
});
