import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    incomeDeduction: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE, PUT } from "@/app/api/income/[id]/deductions/[deductionId]/route";

describe("[Unit] income deduction item route PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a deduction when it belongs to the specified income source", async () => {
    mockPrisma.incomeDeduction.findFirst.mockResolvedValue({
      id: 5,
      incomeSourceId: 1,
    });
    mockPrisma.incomeDeduction.update.mockResolvedValue({
      id: 5,
      incomeSourceId: 1,
      deductionType: "OTHER",
      name: "Charity",
      amount: "80",
      isPercentage: false,
      percentageValue: null,
      isActive: false,
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/income/1/deductions/5", {
        method: "PUT",
        body: JSON.stringify({
          name: " Charity ",
          amount: "80",
          isActive: false,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", deductionId: "5" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.incomeDeduction.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        name: "Charity",
        amount: 80,
        isActive: false,
      },
    });
    expect(await response.json()).toEqual({
      id: 5,
      incomeSourceId: 1,
      deductionType: "OTHER",
      name: "Charity",
      amount: "80",
      isPercentage: false,
      percentageValue: null,
      isActive: false,
    });
  });

  it("should return a 400 error when the income source id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/income/abc/deductions/5", {
        method: "PUT",
        body: JSON.stringify({
          amount: 10,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "abc", deductionId: "5" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid income source id",
    });
    expect(mockPrisma.incomeDeduction.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the deduction id is invalid", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/income/1/deductions/nope", {
        method: "PUT",
        body: JSON.stringify({
          amount: 10,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", deductionId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid deduction id",
    });
    expect(mockPrisma.incomeDeduction.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the deduction does not belong to the income source", async () => {
    mockPrisma.incomeDeduction.findFirst.mockResolvedValue(null);

    const response = await PUT(
      new NextRequest("http://localhost/api/income/1/deductions/999", {
        method: "PUT",
        body: JSON.stringify({
          amount: 10,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", deductionId: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Deduction not found",
    });
    expect(mockPrisma.incomeDeduction.update).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the update payload is empty after validation", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/income/1/deductions/5", {
        method: "PUT",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", deductionId: "5" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "At least one field is required",
    });
    expect(mockPrisma.incomeDeduction.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await PUT(
      new NextRequest("http://localhost/api/income/1/deductions/5", {
        method: "PUT",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1", deductionId: "5" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON body",
    });
  });
});

describe("[Unit] income deduction item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a deduction when it belongs to the specified income source", async () => {
    mockPrisma.incomeDeduction.findFirst.mockResolvedValue({
      id: 5,
      incomeSourceId: 1,
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/income/1/deductions/5"),
      {
        params: Promise.resolve({ id: "1", deductionId: "5" }),
      },
    );

    expect(response.status).toBe(204);
    expect(mockPrisma.incomeDeduction.delete).toHaveBeenCalledWith({
      where: { id: 5 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the income source id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/income/nope/deductions/5"),
      {
        params: Promise.resolve({ id: "nope", deductionId: "5" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid income source id",
    });
    expect(mockPrisma.incomeDeduction.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the deduction id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/income/1/deductions/nope"),
      {
        params: Promise.resolve({ id: "1", deductionId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid deduction id",
    });
    expect(mockPrisma.incomeDeduction.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the deduction does not belong to the income source", async () => {
    mockPrisma.incomeDeduction.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("http://localhost/api/income/1/deductions/999"),
      {
        params: Promise.resolve({ id: "1", deductionId: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Deduction not found",
    });
    expect(mockPrisma.incomeDeduction.delete).not.toHaveBeenCalled();
  });
});
