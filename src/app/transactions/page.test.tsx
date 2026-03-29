// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const defaultCategories = [
  { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
  { id: "cat-2", name: "Transport", colorCode: "#3b82f6" },
];

const singleTransaction = buildTransaction({
  id: "txn-1",
  categoryId: "cat-1",
  amount: "42.50",
  transactionDate: "2026-03-10T00:00:00.000Z",
  description: "Weekly shop",
  vendor: "Tesco",
  category: defaultCategories[0],
});

describe("[Component] transactions page — edit transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should show an inline edit form when a transaction row is clicked", async () => {
    stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should pre-populate the edit form with the transaction's current values", async () => {
    stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    const categorySelect = screen.getByDisplayValue("Groceries");
    expect(categorySelect).toBeInTheDocument();

    const amountInput = screen.getByDisplayValue("42.5");
    expect(amountInput).toBeInTheDocument();

    const dateInput = screen.getByDisplayValue("2026-03-10");
    expect(dateInput).toBeInTheDocument();

    const vendorInput = screen.getByDisplayValue("Tesco");
    expect(vendorInput).toBeInTheDocument();

    const descriptionInput = screen.getByDisplayValue("Weekly shop");
    expect(descriptionInput).toBeInTheDocument();
  });

  it("should pre-populate empty strings for null description and vendor", async () => {
    const txn = buildTransaction({
      description: null,
      vendor: null,
    });
    stubFetch(defaultCategories, [txn]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("50.00").closest("tr")!;
    await user.click(row);

    // The form should exist with Save/Cancel buttons
    const editForm = screen.getByRole("button", { name: "Save" }).closest("form")!;

    // Vendor and Description inputs inside the edit form should be empty (not "null")
    const editOptionalInputs = within(editForm).getAllByPlaceholderText("Optional") as HTMLInputElement[];
    expect(editOptionalInputs).toHaveLength(2);
    for (const input of editOptionalInputs) {
      expect(input.value).toBe("");
    }
  });

  it("should close the edit form when the Cancel button is clicked", async () => {
    stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    // The transaction row should be visible again
    expect(screen.getByText("42.50")).toBeInTheDocument();
  });

  it("should call PUT /api/transactions/[id] when saving an edit", async () => {
    const fetchMock = stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    // Change the amount
    const amountInput = screen.getByDisplayValue("42.5");
    await user.clear(amountInput);
    await user.type(amountInput, "99.99");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit?]) =>
          typeof call[0] === "string" &&
          call[0].includes("/api/transactions/txn-1") &&
          call[1]?.method === "PUT",
      );
      expect(putCall).toBeDefined();

      const body = JSON.parse((putCall as [string, RequestInit])[1].body as string);
      expect(body.amount).toBe(99.99);
      expect(body.categoryId).toBe("cat-1");
      expect(body.transactionDate).toBe("2026-03-10T00:00:00.000Z");
    });
  });

  it("should refresh the transaction list after a successful edit", async () => {
    const fetchMock = stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    await user.click(screen.getByRole("button", { name: "Save" }));

    // Wait for the PUT call, then check that transactions were re-fetched
    await waitFor(() => {
      const transactionGets = fetchMock.mock.calls.filter(
        (call: [string, RequestInit?]) =>
          typeof call[0] === "string" && call[0].startsWith("/api/transactions?month="),
      );
      // Initial load + refresh after edit = at least 2 calls
      expect(transactionGets.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("should close the edit form after a successful save", async () => {
    stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });
  });

  it("should display an error message when the update API returns an error", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (typeof url === "string" && url.includes("/api/transactions/txn-1") && options?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({ error: "Category not found" }, 400),
        );
      }
      if (url.startsWith("/api/categories")) {
        return Promise.resolve(jsonResponse(defaultCategories));
      }
      if (url.startsWith("/api/transactions")) {
        return Promise.resolve(jsonResponse([singleTransaction]));
      }
      return Promise.resolve(jsonResponse({ error: "Not found" }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Category not found")).toBeInTheDocument();
    });

    // The edit form should remain open so the user can fix the issue
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("should not open the edit form when the Delete button is clicked", async () => {
    const fetchMock = stubFetch(defaultCategories, [singleTransaction]);
    // Make delete respond with 204
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (typeof url === "string" && url.includes("/api/transactions/txn-1") && options?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.startsWith("/api/categories")) {
        return Promise.resolve(jsonResponse(defaultCategories));
      }
      if (url.startsWith("/api/transactions")) {
        return Promise.resolve(jsonResponse([singleTransaction]));
      }
      return Promise.resolve(jsonResponse({ error: "Not found" }, 404));
    });

    const user = userEvent.setup();

    render(<TransactionsPage />);

    await screen.findByRole("table");
    const deleteButton = await screen.findByRole("button", { name: "Delete" });
    await user.click(deleteButton);

    // The edit form should NOT appear
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("should only allow one row to be edited at a time", async () => {
    const transactions = [
      singleTransaction,
      buildTransaction({
        id: "txn-2",
        categoryId: "cat-2",
        amount: "15.00",
        transactionDate: "2026-03-12T00:00:00.000Z",
        vendor: "Bus",
        category: defaultCategories[1],
      }),
    ];
    stubFetch(defaultCategories, transactions);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");

    // Click the first row to edit it
    const firstRow = within(table).getByText("42.50").closest("tr")!;
    await user.click(firstRow);

    expect(screen.getByDisplayValue("42.5")).toBeInTheDocument();

    // Click the second row — should switch to editing that one
    const secondRow = within(table).getByText("15.00").closest("tr")!;
    await user.click(secondRow);

    await waitFor(() => {
      expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    });

    // Only one Save button should be present
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
  });

  it("should give the editing row a distinct background style", async () => {
    stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    // After clicking, the editing tr should have bg-stone-50
    const editingRow = screen.getByRole("button", { name: "Save" }).closest("tr")!;
    expect(editingRow.className).toContain("bg-stone-50");
  });

  it("should make non-editing rows clickable with cursor-pointer", async () => {
    stubFetch(defaultCategories, [singleTransaction]);

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;

    expect(row.className).toContain("cursor-pointer");
  });
});
