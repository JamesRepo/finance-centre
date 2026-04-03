import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    category: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/categories/route";

function createKnownRequestError(code: string) {
  return Object.assign(
    Object.create(Prisma.PrismaClientKnownRequestError.prototype),
    { code },
  );
}

describe("[Unit] categories collection route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all categories ordered by name with usage counts when categories exist", async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "category-2",
        name: "Eating Out",
        colorCode: "#f59e0b",
        isSystem: false,
        showOnDashboardDailySpending: true,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        _count: {
          transactions: 3,
          budgets: 1,
        },
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      include: {
        _count: {
          select: {
            transactions: true,
            budgets: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    expect(body).toEqual([
      {
        id: "category-2",
        name: "Eating Out",
        colorCode: "#f59e0b",
        isSystem: false,
        showOnDashboardDailySpending: true,
        createdAt: "2026-03-01T00:00:00.000Z",
        transactionCount: 3,
        budgetCount: 1,
      },
    ]);
  });
});

describe("[Unit] categories collection route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a category when the payload is valid", async () => {
    mockPrisma.category.create.mockResolvedValue({
      id: "category-3",
      name: "Utilities",
      colorCode: "#123456",
      isSystem: false,
      showOnDashboardDailySpending: true,
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: " Utilities ",
          colorCode: "#123456",
          showOnDashboardDailySpending: true,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.category.create).toHaveBeenCalledWith({
      data: {
        name: "Utilities",
        colorCode: "#123456",
        showOnDashboardDailySpending: true,
      },
    });
    expect(await response.json()).toEqual({
      id: "category-3",
      name: "Utilities",
      colorCode: "#123456",
      isSystem: false,
      showOnDashboardDailySpending: true,
      createdAt: "2026-03-02T00:00:00.000Z",
      transactionCount: 0,
      budgetCount: 0,
    });
  });

  it("should store a null color when the submitted color is blank", async () => {
    mockPrisma.category.create.mockResolvedValue({
      id: "category-4",
      name: "Bills",
      colorCode: null,
      isSystem: false,
      showOnDashboardDailySpending: false,
      createdAt: new Date("2026-03-03T00:00:00.000Z"),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: "Bills",
          colorCode: "   ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.category.create).toHaveBeenCalledWith({
      data: {
        name: "Bills",
        colorCode: null,
        showOnDashboardDailySpending: false,
      },
    });
  });

  it("should return a 400 error when the payload is invalid", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: "Utilities",
          colorCode: "#12345",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Color must be a valid 6-digit hex code",
    });
    expect(mockPrisma.category.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
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

  it("should return a 409 error when the category name already exists", async () => {
    mockPrisma.category.create.mockRejectedValue(createKnownRequestError("P2002"));

    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: "Utilities",
          colorCode: "#123456",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "A category with this name already exists",
    });
  });
});
