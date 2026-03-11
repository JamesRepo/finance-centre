import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    savingsContribution: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { DELETE } from "@/app/api/savings/[id]/contributions/[contributionId]/route";

describe("[Unit] savings contribution item route DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a contribution when it belongs to the specified savings goal", async () => {
    mockPrisma.savingsContribution.findFirst.mockResolvedValue({
      id: 4,
      goalId: 1,
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/savings/1/contributions/4"),
      {
        params: Promise.resolve({ id: "1", contributionId: "4" }),
      },
    );

    expect(response.status).toBe(204);
    expect(mockPrisma.savingsContribution.findFirst).toHaveBeenCalledWith({
      where: {
        id: 4,
        goalId: 1,
      },
    });
    expect(mockPrisma.savingsContribution.delete).toHaveBeenCalledWith({
      where: { id: 4 },
    });
    expect(await response.text()).toBe("");
  });

  it("should return a 400 error when the savings goal id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/savings/nope/contributions/4"),
      {
        params: Promise.resolve({ id: "nope", contributionId: "4" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid savings goal id",
    });
    expect(mockPrisma.savingsContribution.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 400 error when the contribution id is invalid", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/savings/1/contributions/nope"),
      {
        params: Promise.resolve({ id: "1", contributionId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid contribution id",
    });
    expect(mockPrisma.savingsContribution.findFirst).not.toHaveBeenCalled();
  });

  it("should return a 404 error when the contribution does not belong to the savings goal", async () => {
    mockPrisma.savingsContribution.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("http://localhost/api/savings/1/contributions/999"),
      {
        params: Promise.resolve({ id: "1", contributionId: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Contribution not found",
    });
    expect(mockPrisma.savingsContribution.delete).not.toHaveBeenCalled();
  });
});
