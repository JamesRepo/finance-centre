import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    category: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, PUT } from "@/app/api/categories/[id]/route";

function createKnownRequestError(code: string) {
  return Object.assign(
    Object.create(Prisma.PrismaClientKnownRequestError.prototype),
    { code },
  );
}

describe("[Unit] category item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a category when the payload is valid and the category exists", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      name: "Groceries",
      colorCode: "#22c55e",
      showOnDashboardDailySpending: false,
      _count: {
        transactions: 2,
        budgets: 1,
      },
    });
    mockPrisma.category.update.mockResolvedValue({
      id: "category-1",
      name: "Food",
      colorCode: "#334455",
      isSystem: false,
      showOnDashboardDailySpending: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/categories/category-1", {
        method: "PUT",
        body: JSON.stringify({
          name: " Food ",
          colorCode: "#334455",
          showOnDashboardDailySpending: true,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "category-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: "category-1" },
      include: {
        _count: {
          select: {
            transactions: true,
            budgets: true,
          },
        },
      },
    });
    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: "category-1" },
      data: {
        name: "Food",
        colorCode: "#334455",
        showOnDashboardDailySpending: true,
      },
    });
    expect(await response.json()).toEqual({
      id: "category-1",
      name: "Food",
      colorCode: "#334455",
      isSystem: false,
      showOnDashboardDailySpending: true,
      createdAt: "2026-03-01T00:00:00.000Z",
      transactionCount: 2,
      budgetCount: 1,
    });
  });

  it("should return a 404 error when the category does not exist", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/categories/missing", {
        method: "PUT",
        body: JSON.stringify({
          name: "Utilities",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "missing" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Category not found",
    });
    expect(mockPrisma.category.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/categories/category-1", {
        method: "PUT",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "category-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field is required",
    });
    expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/categories/category-1", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "category-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });

  it("should return a 409 error when the updated category name already exists", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      _count: {
        transactions: 0,
        budgets: 0,
      },
    });
    mockPrisma.category.update.mockRejectedValue(createKnownRequestError("P2002"));

    const response = await PUT(
      new NextRequest("http://localhost/api/categories/category-1", {
        method: "PUT",
        body: JSON.stringify({
          name: "Utilities",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "category-1" }),
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "A category with this name already exists",
    });
  });
});

describe("[Unit] category item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a category when it has no related transactions or budgets", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      _count: {
        transactions: 0,
        budgets: 0,
      },
    });

    const response = await DELETE(new NextRequest("http://localhost/api/categories/category-1"), {
      params: Promise.resolve({ id: "category-1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.category.delete).toHaveBeenCalledWith({
      where: { id: "category-1" },
    });
  });

  it("should return a 404 error when deleting a missing category", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/categories/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Category not found",
    });
    expect(mockPrisma.category.delete).not.toHaveBeenCalled();
  });

  it("should return a 409 error when the category is used by transactions", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      _count: {
        transactions: 2,
        budgets: 0,
      },
    });

    const response = await DELETE(new NextRequest("http://localhost/api/categories/category-1"), {
      params: Promise.resolve({ id: "category-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Cannot delete a category that is used by transactions",
    });
    expect(mockPrisma.category.delete).not.toHaveBeenCalled();
  });

  it("should return a 409 error when the category is used by budgets", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "category-1",
      _count: {
        transactions: 0,
        budgets: 3,
      },
    });

    const response = await DELETE(new NextRequest("http://localhost/api/categories/category-1"), {
      params: Promise.resolve({ id: "category-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Cannot delete a category that is used by budgets",
    });
    expect(mockPrisma.category.delete).not.toHaveBeenCalled();
  });
});
