import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    budgetPlan: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  DELETE,
  GET,
  PUT,
} from "@/app/api/budget-plans/[id]/route";

function routeContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function request(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/budget-plans/7", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function plan(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-05-11T10:00:00.000Z");

  return {
    id: 7,
    name: "Annual plan",
    startMonth: new Date("2026-06-01T00:00:00.000Z"),
    endMonth: new Date("2026-08-01T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 10,
        planId: 7,
        stream: "INCOME",
        sourceId: null,
        label: "Income",
        amount: new Prisma.Decimal("3000"),
        cadence: "MONTHLY",
        colorCode: null,
        sortOrder: 1,
        isCustom: false,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 11,
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
      },
    ],
    ...overrides,
  };
}

describe("[Unit] budget plan id route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the serialized plan when the id exists", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(plan());

    const response = await GET(request("GET"), routeContext("7"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.budgetPlan.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      include: {
        items: {
          orderBy: [{ stream: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
        },
      },
    });
    expect(body).toMatchObject({
      id: 7,
      name: "Annual plan",
      startMonth: "2026-06",
      endMonth: "2026-08",
      summary: {
        income: 9000,
        spending: 1200,
        outgoings: 1200,
        netPosition: 7800,
        averageMonthlyNet: 2600,
      },
    });
  });

  it("should return not found when the id does not exist", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(null);

    const response = await GET(request("GET"), routeContext("404"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Budget plan not found" });
  });

  it("should reject the request when the id is invalid", async () => {
    const response = await GET(request("GET"), routeContext("nope"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mockPrisma.budgetPlan.findUnique).not.toHaveBeenCalled();
  });
});

describe("[Unit] budget plan id route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update plan fields when the payload is valid", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(plan());
    mockPrisma.budgetPlan.update.mockResolvedValue(
      plan({
        name: "Updated plan",
        startMonth: new Date("2026-07-01T00:00:00.000Z"),
      }),
    );

    const response = await PUT(
      request("PUT", {
        name: "Updated plan",
        startMonth: "2026-07",
      }),
      routeContext("7"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.budgetPlan.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        name: "Updated plan",
        startMonth: new Date("2026-07-01T00:00:00.000Z"),
      },
      include: {
        items: {
          orderBy: [{ stream: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
        },
      },
    });
    expect(body).toMatchObject({
      name: "Updated plan",
      startMonth: "2026-07",
      endMonth: "2026-08",
    });
  });

  it("should reject the update when a partial range would make the end month before the start month", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(plan());

    const response = await PUT(
      request("PUT", {
        startMonth: "2026-09",
      }),
      routeContext("7"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "End month must be on or after start month",
    });
    expect(mockPrisma.budgetPlan.update).not.toHaveBeenCalled();
  });

  it("should reject the update when the payload is empty", async () => {
    const response = await PUT(request("PUT", {}), routeContext("7"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "At least one field is required" });
    expect(mockPrisma.budgetPlan.findUnique).not.toHaveBeenCalled();
  });

  it("should return not found when updating a missing plan", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(null);

    const response = await PUT(
      request("PUT", {
        name: "Missing",
      }),
      routeContext("404"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Budget plan not found" });
    expect(mockPrisma.budgetPlan.update).not.toHaveBeenCalled();
  });
});

describe("[Unit] budget plan id route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete the plan when the id exists", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(plan({ items: [] }));
    mockPrisma.budgetPlan.delete.mockResolvedValue(plan({ items: [] }));

    const response = await DELETE(request("DELETE"), routeContext("7"));

    expect(response.status).toBe(204);
    expect(mockPrisma.budgetPlan.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
  });

  it("should return not found when deleting a missing plan", async () => {
    mockPrisma.budgetPlan.findUnique.mockResolvedValue(null);

    const response = await DELETE(request("DELETE"), routeContext("404"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Budget plan not found" });
    expect(mockPrisma.budgetPlan.delete).not.toHaveBeenCalled();
  });
});
