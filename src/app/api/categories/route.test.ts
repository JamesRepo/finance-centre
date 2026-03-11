import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    category: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/categories/route";

describe("[Unit] categories route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all categories ordered by name", async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "category-2",
        name: "Eating Out",
        colorCode: "#f59e0b",
      },
      {
        id: "category-1",
        name: "Groceries",
        colorCode: "#22c55e",
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      orderBy: {
        name: "asc",
      },
    });
    expect(body).toEqual([
      {
        id: "category-2",
        name: "Eating Out",
        colorCode: "#f59e0b",
      },
      {
        id: "category-1",
        name: "Groceries",
        colorCode: "#22c55e",
      },
    ]);
  });
});
