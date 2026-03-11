import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, PUT } from "@/app/api/subscriptions/[id]/route";

describe("[Unit] subscription item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a subscription when the id and payload are valid", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 1,
      name: "Spotify",
    });
    mockPrisma.subscription.update.mockResolvedValue({
      id: 1,
      name: "Prime Video",
      amount: new Prisma.Decimal("120"),
      frequency: "YEARLY",
      nextPaymentDate: new Date("2027-01-01T00:00:00.000Z"),
      description: null,
      isActive: false,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/subscriptions/1", {
        method: "PUT",
        body: JSON.stringify({
          name: " Prime Video ",
          amount: "120",
          frequency: "YEARLY",
          nextPaymentDate: "2027-01-01T00:00:00.000Z",
          description: null,
          isActive: false,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "Prime Video",
        amount: 120,
        frequency: "YEARLY",
        nextPaymentDate: new Date("2027-01-01T00:00:00.000Z"),
        description: null,
        isActive: false,
      },
    });
    expect(await response.json()).toMatchObject({
      id: 1,
      monthlyEquivalent: "10",
      description: null,
    });
  });

  it("should return a 400 error when the subscription id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/subscriptions/nope", {
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
      error: "Invalid subscription id",
    });
    expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the subscription does not exist", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/subscriptions/999", {
        method: "PUT",
        body: JSON.stringify({
          name: "Updated",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Subscription not found",
    });
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/subscriptions/1", {
        method: "PUT",
        body: JSON.stringify({
          description: "   ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field is required",
    });
    expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/subscriptions/1", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});

describe("[Unit] subscription item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a subscription when the subscription exists", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 1,
    });

    const response = await DELETE(new NextRequest("http://localhost/api/subscriptions/1"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.subscription.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the subscription id is invalid", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/subscriptions/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid subscription id",
    });
    expect(mockPrisma.subscription.delete).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the subscription does not exist", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/subscriptions/999"), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Subscription not found",
    });
    expect(mockPrisma.subscription.delete).not.toHaveBeenCalled();
  });
});
