import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    budgetPlan: {
      findUnique: vi.fn(),
    },
    budgetPlanItem: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/budget-plans/[id]/items/route";
import {
  DELETE,
  PUT,
} from "@/app/api/budget-plans/[id]/items/[itemId]/route";

function routeContext(id: string, itemId = "10") {
  return {
    params: Promise.resolve({ id, itemId }),
  };
}

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function item(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-05-11T10:00:00.000Z");

  return {
    id: 10,
    planId: 7,
    stream: "CATEGORY",
    sourceId: "cat-1",
    label: "Food",
    amount: new Prisma.Decimal("400"),
    cadence: "MONTHLY",
    colorCode: "#16a34a",
    sortOrder: 2,
    isCustom: false,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function plan(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-05-11T10:00:00.000Z");

  return {
    id: 7,
    name: "Annual plan",
    startMonth: new Date("2026-06-01T00:00:00.000Z"),
    endMonth: new Date("2026-06-01T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    items: [item()],
    ...overrides,
  };
}

describe("[Unit] budget plan items route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a custom item with the next sort order when the plan exists", async () => {
    mockPrisma.budgetPlan.findUnique
      .mockResolvedValueOnce(plan({ items: [] }))
      .mockResolvedValueOnce(
        plan({
          items: [
            item({
              id: 11,
              stream: "HOLIDAY",
              sourceId: null,
              label: "Summer trip",
              amount: new Prisma.Decimal("1200"),
              cadence: "YEARLY",
              colorCode: "#2563eb",
              sortOrder: 8,
              isCustom: true,
            }),
          ],
        }),
      );
    mockPrisma.budgetPlanItem.findFirst.mockResolvedValue({ sortOrder: 7 });
    mockPrisma.budgetPlanItem.create.mockResolvedValue(
      item({
        id: 11,
        stream: "HOLIDAY",
        label: "Summer trip",
        isCustom: true,
      }),
    );

    const response = await POST(
      request("http://localhost/api/budget-plans/7/items", "POST", {
        stream: "HOLIDAY",
        label: "Summer trip",
        amount: "1200",
        cadence: "YEARLY",
        colorCode: "#2563eb",
      }),
      routeContext("7"),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.budgetPlanItem.create).toHaveBeenCalledWith({
      data: {
        planId: 7,
        stream: "HOLIDAY",
        sourceId: null,
        label: "Summer trip",
        amount: 1200,
        cadence: "YEARLY",
        colorCode: "#2563eb",
        sortOrder: 8,
        isCustom: true,
        enabled: true,
      },
    });
    expect(body.items).toEqual([
      expect.objectContaining({
        id: 11,
        stream: "HOLIDAY",
        label: "Summer trip",
        isCustom: true,
      }),
    ]);
  });

  it("should return not found when creating an item for a missing plan", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(null);

    const response = await POST(
      request("http://localhost/api/budget-plans/404/items", "POST", {
        stream: "HOLIDAY",
        label: "Summer trip",
        amount: "1200",
        cadence: "YEARLY",
      }),
      routeContext("404"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Budget plan not found" });
    expect(mockPrisma.budgetPlanItem.create).not.toHaveBeenCalled();
  });

  it("should reject the request when the custom item payload is invalid", async () => {
    const response = await POST(
      request("http://localhost/api/budget-plans/7/items", "POST", {
        stream: "HOLIDAY",
        label: "Summer trip",
        amount: "-1",
        cadence: "YEARLY",
      }),
      routeContext("7"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mockPrisma.budgetPlan.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.budgetPlanItem.create).not.toHaveBeenCalled();
  });
});

describe("[Unit] budget plan item id route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update an item scoped to its plan when the payload is valid", async () => {
    mockPrisma.budgetPlanItem.findFirst.mockResolvedValue(item());
    mockPrisma.budgetPlanItem.update.mockResolvedValue(
      item({
        amount: new Prisma.Decimal("125.50"),
        enabled: false,
      }),
    );
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(
      plan({
        items: [
          item({
            amount: new Prisma.Decimal("125.50"),
            enabled: false,
          }),
        ],
      }),
    );

    const response = await PUT(
      request("http://localhost/api/budget-plans/7/items/10", "PUT", {
        amount: "125.50",
        enabled: false,
      }),
      routeContext("7", "10"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.budgetPlanItem.findFirst).toHaveBeenCalledWith({
      where: { id: 10, planId: 7 },
    });
    expect(mockPrisma.budgetPlanItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        amount: 125.5,
        enabled: false,
      },
    });
    expect(body.items[0]).toMatchObject({
      id: 10,
      amount: "125.5",
      enabled: false,
    });
  });

  it("should return not found when updating an item outside the plan", async () => {
    mockPrisma.budgetPlanItem.findFirst.mockResolvedValue(null);

    const response = await PUT(
      request("http://localhost/api/budget-plans/7/items/10", "PUT", {
        amount: "125.50",
      }),
      routeContext("7", "10"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Budget plan item not found" });
    expect(mockPrisma.budgetPlanItem.update).not.toHaveBeenCalled();
  });

  it("should reject the update when the payload is empty", async () => {
    const response = await PUT(
      request("http://localhost/api/budget-plans/7/items/10", "PUT", {}),
      routeContext("7", "10"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "At least one field is required" });
    expect(mockPrisma.budgetPlanItem.findFirst).not.toHaveBeenCalled();
  });
});

describe("[Unit] budget plan item id route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a custom item when the item belongs to the plan", async () => {
    mockPrisma.budgetPlanItem.findFirst.mockResolvedValue(
      item({
        isCustom: true,
      }),
    );
    mockPrisma.budgetPlanItem.delete.mockResolvedValue(item({ isCustom: true }));
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(plan({ items: [] }));

    const response = await DELETE(
      request("http://localhost/api/budget-plans/7/items/10", "DELETE"),
      routeContext("7", "10"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.budgetPlanItem.delete).toHaveBeenCalledWith({
      where: { id: 10 },
    });
    expect(mockPrisma.budgetPlanItem.update).not.toHaveBeenCalled();
    expect(body.items).toEqual([]);
  });

  it("should disable a seeded item when the item belongs to the plan", async () => {
    mockPrisma.budgetPlanItem.findFirst.mockResolvedValue(item({ isCustom: false }));
    mockPrisma.budgetPlanItem.update.mockResolvedValue(
      item({
        enabled: false,
      }),
    );
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(
      plan({
        items: [
          item({
            enabled: false,
          }),
        ],
      }),
    );

    const response = await DELETE(
      request("http://localhost/api/budget-plans/7/items/10", "DELETE"),
      routeContext("7", "10"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.budgetPlanItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { enabled: false },
    });
    expect(mockPrisma.budgetPlanItem.delete).not.toHaveBeenCalled();
    expect(body.items[0]).toMatchObject({
      id: 10,
      enabled: false,
    });
  });

  it("should reject the request when the item id is invalid", async () => {
    const response = await DELETE(
      request("http://localhost/api/budget-plans/7/items/nope", "DELETE"),
      routeContext("7", "nope"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mockPrisma.budgetPlanItem.findFirst).not.toHaveBeenCalled();
  });
});
