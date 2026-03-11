import { describe, expect, it, vi } from "vitest";
import {
  createTransactionRequest,
  formatTransactionDisplayDate,
} from "@/app/transactions/transaction-page-helpers";

describe("[Unit] transaction page helpers", () => {
  it("should format transaction dates from the ISO date portion without timezone drift", () => {
    expect(formatTransactionDisplayDate("2026-03-10T00:00:00.000Z")).toBe(
      "10 Mar 2026",
    );
  });

  it("should submit the date at UTC midnight and return the submitted month", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "txn-1" }), {
        status: 201,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const result = await createTransactionRequest(
      {
        categoryId: "cat-1",
        amount: 12.5,
        transactionDate: "2026-03-10",
        description: "Lunch",
        vendor: "Cafe",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: true,
      submittedMonth: "2026-03",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        categoryId: "cat-1",
        amount: 12.5,
        transactionDate: "2026-03-10T00:00:00.000Z",
        description: "Lunch",
        vendor: "Cafe",
      }),
    });
  });

  it("should return a friendly error when transaction creation fails before a response", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network unavailable"));

    const result = await createTransactionRequest(
      {
        categoryId: "cat-1",
        amount: 12.5,
        transactionDate: "2026-03-10",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: false,
      error: "Network unavailable",
    });
  });
});
