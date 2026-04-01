import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    holiday: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, GET, PUT } from "@/app/api/holidays/[id]/route";

describe("[Unit] holiday item route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a holiday with totalCost and expenseBreakdown when the holiday exists", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue({
      id: 7,
      name: "Japan",
      destination: "Tokyo",
      assignedMonth: "2026-10",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-10T00:00:00.000Z"),
      description: "Autumn trip",
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      holidayExpenses: [
        {
          id: 1,
          holidayId: 7,
          expenseType: "FOOD",
          description: "Sushi",
          amount: new Prisma.Decimal("45.25"),
          expenseDate: new Date("2026-10-03T00:00:00.000Z"),
          notes: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        {
          id: 2,
          holidayId: 7,
          expenseType: "FLIGHT",
          description: "Outbound flight",
          amount: new Prisma.Decimal("700"),
          expenseDate: new Date("2026-10-01T00:00:00.000Z"),
          notes: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        {
          id: 3,
          holidayId: 7,
          expenseType: "FOOD",
          description: "Ramen",
          amount: new Prisma.Decimal("12.75"),
          expenseDate: new Date("2026-10-04T00:00:00.000Z"),
          notes: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ],
    });

    const response = await GET(new NextRequest("http://localhost/api/holidays/7"), {
      params: Promise.resolve({ id: "7" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.holiday.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      include: {
        holidayExpenses: {
          orderBy: {
            expenseDate: "asc",
          },
        },
      },
    });
    expect(body).toMatchObject({
      id: 7,
      assignedMonth: "2026-10",
      totalCost: "758",
      expenseBreakdown: [
        { expenseType: "FLIGHT", totalCost: "700" },
        { expenseType: "FOOD", totalCost: "58" },
      ],
    });
  });

  it("should return a 400 error when the holiday id is invalid", async () => {
    const response = await GET(new NextRequest("http://localhost/api/holidays/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid holiday id",
    });
    expect(mockPrisma.holiday.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the holiday does not exist", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/holidays/404"), {
      params: Promise.resolve({ id: "404" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Holiday not found",
    });
  });
});

describe("[Unit] holiday item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a holiday when the holiday exists and the payload is valid", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValueOnce({
      id: 7,
      name: "Japan",
      destination: "Tokyo",
      assignedMonth: "2026-10",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-10T00:00:00.000Z"),
      description: "Autumn trip",
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      holidayExpenses: [],
    });
    mockPrisma.holiday.update.mockResolvedValue({
      id: 7,
      name: "Japan Updated",
      destination: "Kyoto",
      assignedMonth: "2026-11",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-12T00:00:00.000Z"),
      description: null,
      isActive: false,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      holidayExpenses: [
        {
          id: 1,
          holidayId: 7,
          expenseType: "ACCOMMODATION",
          description: "Hotel",
          amount: new Prisma.Decimal("450"),
          expenseDate: new Date("2026-10-01T00:00:00.000Z"),
          notes: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/7", {
        method: "PUT",
        body: JSON.stringify({
          name: " Japan Updated ",
          destination: " Kyoto ",
          assignedMonth: "2026-11",
          endDate: "2026-10-12T00:00:00.000Z",
          description: null,
          isActive: false,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "7" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.holiday.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        name: "Japan Updated",
        destination: "Kyoto",
        assignedMonth: "2026-11",
        endDate: new Date("2026-10-12T00:00:00.000Z"),
        description: null,
        isActive: false,
      },
      include: {
        holidayExpenses: {
          orderBy: {
            expenseDate: "asc",
          },
        },
      },
    });
    expect(await response.json()).toMatchObject({
      id: 7,
      name: "Japan Updated",
      assignedMonth: "2026-11",
      totalCost: "450",
      expenseBreakdown: [
        { expenseType: "ACCOMMODATION", totalCost: "450" },
      ],
    });
  });

  it("should return a 400 error when the holiday id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/nope", {
        method: "PUT",
        body: JSON.stringify({
          name: "Updated",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid holiday id",
    });
    expect(mockPrisma.holiday.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the holiday does not exist", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/7", {
        method: "PUT",
        body: JSON.stringify({
          destination: "Kyoto",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "7" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Holiday not found",
    });
    expect(mockPrisma.holiday.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when merged holiday dates are invalid", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValueOnce({
      id: 7,
      name: "Japan",
      destination: "Tokyo",
      assignedMonth: "2026-10",
      startDate: new Date("2026-10-10T00:00:00.000Z"),
      endDate: new Date("2026-10-20T00:00:00.000Z"),
      description: null,
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      holidayExpenses: [],
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/7", {
        method: "PUT",
        body: JSON.stringify({
          endDate: "2026-10-05T00:00:00.000Z",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "7" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "End date must be on or after start date",
    });
    expect(mockPrisma.holiday.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when assignedMonth is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/7", {
        method: "PUT",
        body: JSON.stringify({
          assignedMonth: "2026-13",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "7" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Month must be in YYYY-MM format",
    });
    expect(mockPrisma.holiday.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/holidays/7", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "7" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});

describe("[Unit] holiday item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a holiday when the holiday exists", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue({
      id: 7,
    });

    const response = await DELETE(new NextRequest("http://localhost/api/holidays/7"), {
      params: Promise.resolve({ id: "7" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.holiday.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the holiday id is invalid", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/holidays/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid holiday id",
    });
    expect(mockPrisma.holiday.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the holiday does not exist", async () => {
    mockPrisma.holiday.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/holidays/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Holiday not found",
    });
    expect(mockPrisma.holiday.delete).not.toHaveBeenCalled();
  });
});
