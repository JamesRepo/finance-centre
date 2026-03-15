// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransactionsPage from "@/app/transactions/page";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type TransactionFixture = {
  id: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  description: string | null;
  vendor: string | null;
  category: {
    id: string;
    name: string;
    colorCode: string | null;
  };
};

function buildTransaction(
  overrides: Partial<TransactionFixture> = {},
): TransactionFixture {
  return {
    id: "txn-1",
    categoryId: "cat-1",
    amount: "50.00",
    transactionDate: "2026-03-10T00:00:00.000Z",
    description: null,
    vendor: null,
    category: { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
    ...overrides,
  };
}

function stubFetch(
  categories: Array<{ id: string; name: string; colorCode: string | null }>,
  transactions: TransactionFixture[],
) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/categories")) {
      return Promise.resolve(jsonResponse(categories));
    }
    if (url.startsWith("/api/transactions")) {
      return Promise.resolve(jsonResponse(transactions));
    }
    return Promise.resolve(jsonResponse({ error: "Not found" }, 404));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function findBadge(table: HTMLElement, name: string) {
  return within(table).findByText(name);
}

describe("[Component] transactions page — category badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should render the category name inside a colored oval badge", async () => {
    stubFetch(
      [{ id: "cat-1", name: "Groceries", colorCode: "#22c55e" }],
      [buildTransaction()],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "Groceries");

    expect(badge.tagName).toBe("SPAN");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("font-semibold");
    expect(badge.style.backgroundColor).toBe("rgb(34, 197, 94)");
  });

  it("should use white text on a dark category color", async () => {
    // #1e1b4b (indigo-950) — YIQ ≈ 33, well below 150 threshold
    const transaction = buildTransaction({
      category: { id: "cat-1", name: "Entertainment", colorCode: "#1e1b4b" },
    });

    stubFetch(
      [{ id: "cat-1", name: "Entertainment", colorCode: "#1e1b4b" }],
      [transaction],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "Entertainment");

    expect(badge.style.color).toBe("rgb(255, 255, 255)");
    expect(badge.style.backgroundColor).toBe("rgb(30, 27, 75)");
  });

  it("should use dark text on a light category color", async () => {
    // #fef08a (yellow-200) — YIQ ≈ 233, well above 150 threshold
    const transaction = buildTransaction({
      category: { id: "cat-1", name: "Bright", colorCode: "#fef08a" },
    });

    stubFetch(
      [{ id: "cat-1", name: "Bright", colorCode: "#fef08a" }],
      [transaction],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "Bright");

    expect(badge.style.color).toBe("rgb(28, 25, 23)");
    expect(badge.style.backgroundColor).toBe("rgb(254, 240, 138)");
  });

  it("should use the fallback color with dark text when the category has no colorCode", async () => {
    // null colorCode → fallback #a8a29e (stone-400, YIQ ≈ 163 → light → dark text)
    const transaction = buildTransaction({
      category: { id: "cat-1", name: "Uncategorized", colorCode: null },
    });

    stubFetch(
      [{ id: "cat-1", name: "Uncategorized", colorCode: null }],
      [transaction],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "Uncategorized");

    expect(badge.style.backgroundColor).toBe("rgb(168, 162, 158)");
    expect(badge.style.color).toBe("rgb(28, 25, 23)");
  });

  it("should use white text for a color just below the light threshold", async () => {
    // #22c55e (green-500) — YIQ ≈ 137, just below the 150 threshold → dark → white text
    stubFetch(
      [{ id: "cat-1", name: "Groceries", colorCode: "#22c55e" }],
      [buildTransaction()],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "Groceries");

    expect(badge.style.color).toBe("rgb(255, 255, 255)");
  });

  it("should use dark text for a color just above the light threshold", async () => {
    // #f59e0b (amber-500) — YIQ ≈ 167, just above the 150 threshold → light → dark text
    const transaction = buildTransaction({
      category: { id: "cat-1", name: "Amber", colorCode: "#f59e0b" },
    });

    stubFetch(
      [{ id: "cat-1", name: "Amber", colorCode: "#f59e0b" }],
      [transaction],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "Amber");

    expect(badge.style.color).toBe("rgb(28, 25, 23)");
  });

  it("should render distinct badges for multiple categories in the transaction list", async () => {
    const transactions = [
      buildTransaction({
        id: "txn-1",
        category: { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
      }),
      buildTransaction({
        id: "txn-2",
        category: { id: "cat-2", name: "Transport", colorCode: "#3b82f6" },
      }),
      buildTransaction({
        id: "txn-3",
        category: { id: "cat-3", name: "Dining", colorCode: "#fef08a" },
      }),
    ];

    stubFetch(
      [
        { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
        { id: "cat-2", name: "Transport", colorCode: "#3b82f6" },
        { id: "cat-3", name: "Dining", colorCode: "#fef08a" },
      ],
      transactions,
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const groceries = await findBadge(table, "Groceries");
    const transport = await findBadge(table, "Transport");
    const dining = await findBadge(table, "Dining");

    // Each badge has its own background color
    expect(groceries.style.backgroundColor).toBe("rgb(34, 197, 94)");
    expect(transport.style.backgroundColor).toBe("rgb(59, 130, 246)");
    expect(dining.style.backgroundColor).toBe("rgb(254, 240, 138)");

    // Dark backgrounds get white text, light backgrounds get dark text
    expect(groceries.style.color).toBe("rgb(255, 255, 255)");
    expect(transport.style.color).toBe("rgb(255, 255, 255)");
    expect(dining.style.color).toBe("rgb(28, 25, 23)");
  });

  it("should use white text for pure black", async () => {
    const transaction = buildTransaction({
      category: { id: "cat-1", name: "Black", colorCode: "#000000" },
    });

    stubFetch(
      [{ id: "cat-1", name: "Black", colorCode: "#000000" }],
      [transaction],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "Black");

    expect(badge.style.backgroundColor).toBe("rgb(0, 0, 0)");
    expect(badge.style.color).toBe("rgb(255, 255, 255)");
  });

  it("should use dark text for pure white", async () => {
    const transaction = buildTransaction({
      category: { id: "cat-1", name: "White", colorCode: "#ffffff" },
    });

    stubFetch(
      [{ id: "cat-1", name: "White", colorCode: "#ffffff" }],
      [transaction],
    );

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const badge = await findBadge(table, "White");

    expect(badge.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(badge.style.color).toBe("rgb(28, 25, 23)");
  });
});
