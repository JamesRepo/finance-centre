import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, PUT } from "@/app/api/transactions/[id]/route";

describe("[Unit] transaction item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a transaction when the transaction and category exist", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValueOnce({
      id: "txn-1",
    });
    mockPrisma.category.findUnique.mockResolvedValue({
      id: "cat-2",
      name: "Transport",
    });
    mockPrisma.transaction.update.mockResolvedValue({
      id: "txn-1",
      amount: "18.75",
      categoryId: "cat-2",
      category: {
        id: "cat-2",
        name: "Transport",
      },
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/transactions/txn-1", {
        method: "PUT",
        body: JSON.stringify({
          amount: "18.75",
          categoryId: "cat-2",
          vendor: " Trainline ",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "txn-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
      where: { id: "txn-1" },
    });
    expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: "cat-2" },
    });
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: {
        amount: 18.75,
        categoryId: "cat-2",
        vendor: "Trainline",
      },
      include: {
        category: true,
      },
    });
    expect(await response.json()).toEqual({
      id: "txn-1",
      amount: "18.75",
      categoryId: "cat-2",
      category: {
        id: "cat-2",
        name: "Transport",
      },
    });
  });

  it("should return a 404 error when the transaction does not exist", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/transactions/missing", {
        method: "PUT",
        body: JSON.stringify({
          vendor: "Cafe",
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
      error: "Transaction not found",
    });
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the replacement category does not exist", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: "txn-1",
    });
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/transactions/txn-1", {
        method: "PUT",
        body: JSON.stringify({
          categoryId: "missing-category",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "txn-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Category not found",
    });
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/transactions/txn-1", {
        method: "PUT",
        body: JSON.stringify({
          description: "   ",
          vendor: "",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "txn-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field is required",
    });
    expect(mockPrisma.transaction.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/transactions/txn-1", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "txn-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});

describe("[Unit] transaction item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a transaction when the transaction exists", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: "txn-1",
    });

    const response = await DELETE(new NextRequest("http://localhost/api/transactions/txn-1"), {
      params: Promise.resolve({ id: "txn-1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: "txn-1" },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 404 error when the transaction does not exist", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue(null);

    const response = await DELETE(new NextRequest("http://localhost/api/transactions/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Transaction not found",
    });
    expect(mockPrisma.transaction.delete).not.toHaveBeenCalled();
  });
});
