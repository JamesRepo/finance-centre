import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    settings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, PUT } from "@/app/api/settings/route";

const defaultSettings = {
  id: 1,
  currency: "GBP",
  locale: "en-GB",
  monthlyBudgetTotal: null,
  updatedAt: new Date("2026-03-10T00:00:00.000Z"),
};

const publicSelect = {
  id: true,
  currency: true,
  locale: true,
  monthlyBudgetTotal: true,
  updatedAt: true,
};

describe("[Unit] settings route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return existing settings when a row exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(defaultSettings);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 1,
      currency: "GBP",
      locale: "en-GB",
      monthlyBudgetTotal: null,
    });
    expect(mockPrisma.settings.findFirst).toHaveBeenCalledOnce();
    expect(mockPrisma.settings.create).not.toHaveBeenCalled();
  });

  it("should not expose email or passwordHash in GET response", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(defaultSettings);

    await GET();

    expect(mockPrisma.settings.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        currency: true,
        locale: true,
        monthlyBudgetTotal: true,
        updatedAt: true,
      },
    });
  });

  it("should create a default settings row when none exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(null);
    mockPrisma.settings.create.mockResolvedValue(defaultSettings);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 1,
      currency: "GBP",
    });
    expect(mockPrisma.settings.create).toHaveBeenCalledWith({ data: {}, select: publicSelect });
  });

  it("should return settings with a monthlyBudgetTotal when set", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      ...defaultSettings,
      monthlyBudgetTotal: new Prisma.Decimal("3500"),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.monthlyBudgetTotal).toBe("3500");
  });
});

describe("[Unit] settings route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update existing settings when a row exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(defaultSettings);
    mockPrisma.settings.update.mockResolvedValue({
      ...defaultSettings,
      currency: "USD",
      locale: "en-US",
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ currency: "USD", locale: "en-US" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.currency).toBe("USD");
    expect(body.locale).toBe("en-US");
    expect(mockPrisma.settings.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { currency: "USD", locale: "en-US" },
      select: {
        id: true,
        currency: true,
        locale: true,
        monthlyBudgetTotal: true,
        updatedAt: true,
      },
    });
  });

  it("should create settings when no row exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(null);
    mockPrisma.settings.create.mockResolvedValue({
      ...defaultSettings,
      currency: "EUR",
      locale: "de-DE",
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ currency: "EUR", locale: "de-DE" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.settings.create).toHaveBeenCalledWith({
      data: {
        currency: "EUR",
        locale: "de-DE",
        monthlyBudgetTotal: undefined,
      },
      select: publicSelect,
    });
  });

  it("should create with defaults when no existing row and partial body", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(null);
    mockPrisma.settings.create.mockResolvedValue(defaultSettings);

    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ currency: "GBP" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.settings.create).toHaveBeenCalledWith({
      data: {
        currency: "GBP",
        locale: "en-GB",
        monthlyBudgetTotal: undefined,
      },
      select: publicSelect,
    });
  });

  it("should update monthlyBudgetTotal when provided", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(defaultSettings);
    mockPrisma.settings.update.mockResolvedValue({
      ...defaultSettings,
      monthlyBudgetTotal: new Prisma.Decimal("2500"),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ monthlyBudgetTotal: 2500 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.settings.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { monthlyBudgetTotal: 2500 },
      select: publicSelect,
    });
  });

  it("should accept null for monthlyBudgetTotal to clear it", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      ...defaultSettings,
      monthlyBudgetTotal: new Prisma.Decimal("2000"),
    });
    mockPrisma.settings.update.mockResolvedValue({
      ...defaultSettings,
      monthlyBudgetTotal: null,
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ monthlyBudgetTotal: null }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.settings.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { monthlyBudgetTotal: null },
      select: publicSelect,
    });
  });

  it("should return 400 when body is empty object (no fields)", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field is required",
    });
    expect(mockPrisma.settings.findFirst).not.toHaveBeenCalled();
  });

  it("should return 400 when unexpected fields are provided", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ theme: "system" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("At least one field is required");
    expect(mockPrisma.settings.findFirst).not.toHaveBeenCalled();
  });

  it("should return 400 when JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: "not-json{",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });

  it("should return 400 when currency is an empty string", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ currency: "  " }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.settings.update).not.toHaveBeenCalled();
  });

  it("should return 400 when monthlyBudgetTotal is negative", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ monthlyBudgetTotal: -100 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.settings.update).not.toHaveBeenCalled();
  });

  it("should allow monthlyBudgetTotal of zero", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(defaultSettings);
    mockPrisma.settings.update.mockResolvedValue({
      ...defaultSettings,
      monthlyBudgetTotal: new Prisma.Decimal("0"),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        body: JSON.stringify({ monthlyBudgetTotal: 0 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.settings.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { monthlyBudgetTotal: 0 },
      select: publicSelect,
    });
  });

  it("should propagate unexpected errors", async () => {
    mockPrisma.settings.findFirst.mockRejectedValue(new Error("DB down"));

    await expect(
      PUT(
        new NextRequest("http://localhost/api/settings", {
          method: "PUT",
          body: JSON.stringify({ currency: "GBP" }),
          headers: { "content-type": "application/json" },
        }),
      ),
    ).rejects.toThrow("DB down");
  });
});
