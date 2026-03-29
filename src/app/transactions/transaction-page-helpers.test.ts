import { describe, expect, it, vi } from "vitest";
import {
  createTransactionRequest,
  formatTransactionDisplayDate,
  updateTransactionRequest,
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

  it("should return an API error message when creation responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Category not found" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await createTransactionRequest(
      {
        categoryId: "missing",
        amount: 10,
        transactionDate: "2026-03-10",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: false,
      error: "Category not found",
    });
  });
});

describe("[Unit] updateTransactionRequest", () => {
  it("should send a PUT request with the correct URL, body, and return the submitted month", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "txn-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await updateTransactionRequest(
      "txn-1",
      {
        categoryId: "cat-2",
        amount: 25.5,
        transactionDate: "2026-04-15",
        description: "Dinner",
        vendor: "Restaurant",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: true,
      submittedMonth: "2026-04",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/txn-1", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        categoryId: "cat-2",
        amount: 25.5,
        transactionDate: "2026-04-15T00:00:00.000Z",
        description: "Dinner",
        vendor: "Restaurant",
      }),
    });
  });

  it("should send undefined for optional fields when they are omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "txn-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await updateTransactionRequest(
      "txn-1",
      {
        categoryId: "cat-1",
        amount: 10,
        transactionDate: "2026-03-01",
      },
      fetchMock,
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.description).toBeUndefined();
    expect(body.vendor).toBeUndefined();
  });

  it("should return an API error message when the server responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await updateTransactionRequest(
      "missing",
      {
        categoryId: "cat-1",
        amount: 10,
        transactionDate: "2026-03-10",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: false,
      error: "Transaction not found",
    });
  });

  it("should return a fallback error when the server responds with non-JSON error body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
      }),
    );

    const result = await updateTransactionRequest(
      "txn-1",
      {
        categoryId: "cat-1",
        amount: 10,
        transactionDate: "2026-03-10",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: false,
      error: "Failed to update transaction",
    });
  });

  it("should return a friendly error when the network request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await updateTransactionRequest(
      "txn-1",
      {
        categoryId: "cat-1",
        amount: 10,
        transactionDate: "2026-03-10",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: false,
      error: "Network error",
    });
  });

  it("should return a fallback error when a non-Error value is thrown", async () => {
    const fetchMock = vi.fn().mockRejectedValue("something went wrong");

    const result = await updateTransactionRequest(
      "txn-1",
      {
        categoryId: "cat-1",
        amount: 10,
        transactionDate: "2026-03-10",
      },
      fetchMock,
    );

    expect(result).toEqual({
      ok: false,
      error: "Failed to update transaction",
    });
  });
});
