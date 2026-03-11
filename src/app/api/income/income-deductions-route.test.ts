import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    incomeSource: {
      findUnique: vi.fn(),
    },
    incomeDeduction: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/income/[id]/deductions/route";

describe("[Unit] income deductions route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a deduction when the income source exists and the payload is valid", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValue({
      id: 1,
    });
    mockPrisma.incomeDeduction.create.mockResolvedValue({
      id: 9,
      incomeSourceId: 1,
      deductionType: "NI",
      name: "National Insurance",
      amount: "120",
      isPercentage: false,
      percentageValue: null,
      isActive: true,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/income/1/deductions", {
        method: "POST",
        body: JSON.stringify({
          deductionType: "NI",
          name: " National Insurance ",
          amount: "120",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.incomeDeduction.create).toHaveBeenCalledWith({
      data: {
        incomeSourceId: 1,
        deductionType: "NI",
        name: "National Insurance",
        amount: 120,
      },
    });
    expect(await response.json()).toEqual({
      id: 9,
      incomeSourceId: 1,
      deductionType: "NI",
      name: "National Insurance",
      amount: "120",
      isPercentage: false,
      percentageValue: null,
      isActive: true,
    });
  });

  it("should return a 400 error when the income source id is invalid", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/income/abc/deductions", {
        method: "POST",
        body: JSON.stringify({
          deductionType: "NI",
          name: "Tax",
          amount: 100,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "abc" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid income source id",
    });
    expect(mockPrisma.incomeSource.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the income source does not exist", async () => {
    mockPrisma.incomeSource.findUnique.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/income/1/deductions", {
        method: "POST",
        body: JSON.stringify({
          deductionType: "NI",
          name: "Tax",
          amount: 100,
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Income source not found",
    });
    expect(mockPrisma.incomeDeduction.create).not.toHaveBeenCalled();
  });

  it("should return a 400 error when validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/income/1/deductions", {
        method: "POST",
        body: JSON.stringify({
          deductionType: "OTHER",
          name: "Deduction",
          amount: 0,
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
      error: "Too small: expected number to be >0",
    });
    expect(mockPrisma.incomeSource.findUnique).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/income/1/deductions", {
        method: "POST",
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
