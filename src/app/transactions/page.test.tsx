// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransactionsPage from "@/app/transactions/page";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getAddTransactionForm() {
  return screen.getByRole("button", { name: "Add transaction" }).closest("form")!;
}

function getAddFormCategory(form: HTMLFormElement) {
  return form.querySelector('select[name="categoryId"]') as HTMLSelectElement;
}

function getAddFormDateInput(form: HTMLFormElement) {
  return form.querySelector('input[name="transactionDate"]') as HTMLInputElement;
}

type TransactionFixture = {
  id: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  description: string | null;
  vendor: string | null;
  lineItems: Array<{
    id: string;
    amount: string;
    sortOrder: number;
  }>;
  category: {
    id: string;
    name: string;
    colorCode: string | null;
  };
};

function buildTransaction(
  overrides: Partial<TransactionFixture> = {},
): TransactionFixture {
  const transaction: TransactionFixture = {
    id: "txn-1",
    categoryId: "cat-1",
    amount: "50.00",
    transactionDate: "2026-03-10T00:00:00.000Z",
    description: null,
    vendor: null,
    lineItems: [{ id: "line-1", amount: "50.00", sortOrder: 0 }],
    category: { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
    ...overrides,
  };

  if (overrides.lineItems === undefined) {
    transaction.lineItems = [
      {
        id: `${transaction.id}-line-1`,
        amount: transaction.amount,
        sortOrder: 0,
      },
    ];
  }

  return transaction;
}

function stubFetch(
  categories: Array<{ id: string; name: string; colorCode: string | null }>,
  transactions: TransactionFixture[],
  vendors: string[] = [],
) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/categories")) {
      return Promise.resolve(jsonResponse(categories));
    }
    if (url.startsWith("/api/transactions/vendors")) {
      return Promise.resolve(jsonResponse(vendors));
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
      expect(body.lineItems).toEqual([{ amount: 99.99 }]);
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

  it("should show a split item count for multi-value transactions", async () => {
    stubFetch(defaultCategories, [
      buildTransaction({
        amount: "15.75",
        lineItems: [
          { id: "line-1", amount: "5.25", sortOrder: 0 },
          { id: "line-2", amount: "4.50", sortOrder: 1 },
          { id: "line-3", amount: "6.00", sortOrder: 2 },
        ],
      }),
    ]);

    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("3 items")).toBeInTheDocument();
  });
});

const multiTransactions = [
  buildTransaction({
    id: "txn-a",
    categoryId: "cat-1",
    amount: "10.00",
    transactionDate: "2026-03-05T00:00:00.000Z",
    vendor: "Alpha",
    category: { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
  }),
  buildTransaction({
    id: "txn-b",
    categoryId: "cat-2",
    amount: "20.00",
    transactionDate: "2026-03-15T00:00:00.000Z",
    vendor: "Beta",
    category: { id: "cat-2", name: "Transport", colorCode: "#3b82f6" },
  }),
  buildTransaction({
    id: "txn-c",
    categoryId: "cat-1",
    amount: "30.00",
    transactionDate: "2026-03-20T00:00:00.000Z",
    vendor: "Gamma",
    category: { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
  }),
];

describe("[Component] transactions page — date sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should display a sort button on the Date column header with a descending indicator by default", async () => {
    stubFetch(defaultCategories, [buildTransaction()]);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const sortButton = within(table).getByRole("button", { name: /Date/ });

    expect(sortButton).toBeInTheDocument();
    expect(sortButton.textContent).toContain("↓");
  });

  it("should toggle the sort indicator to ascending when the Date header is clicked", async () => {
    stubFetch(defaultCategories, [buildTransaction()]);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const sortButton = within(table).getByRole("button", { name: /Date/ });

    await user.click(sortButton);

    expect(sortButton.textContent).toContain("↑");
  });

  it("should sort transactions in descending date order by default", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    const html = table.innerHTML;
    const posGamma = html.indexOf("Gamma"); // Mar 20
    const posBeta = html.indexOf("Beta"); // Mar 15
    const posAlpha = html.indexOf("Alpha"); // Mar 05

    expect(posGamma).toBeLessThan(posBeta);
    expect(posBeta).toBeLessThan(posAlpha);
  });

  it("should sort transactions in ascending date order when toggled", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    const sortButton = within(table).getByRole("button", { name: /Date/ });
    await user.click(sortButton);

    const html = table.innerHTML;
    const posAlpha = html.indexOf("Alpha");
    const posBeta = html.indexOf("Beta");
    const posGamma = html.indexOf("Gamma");

    expect(posAlpha).toBeLessThan(posBeta);
    expect(posBeta).toBeLessThan(posGamma);
  });

  it("should toggle back to descending when the sort button is clicked twice", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    const sortButton = within(table).getByRole("button", { name: /Date/ });
    await user.click(sortButton);
    await user.click(sortButton);

    expect(sortButton.textContent).toContain("↓");

    const html = table.innerHTML;
    expect(html.indexOf("Gamma")).toBeLessThan(html.indexOf("Alpha"));
  });
});

describe("[Component] transactions page — category filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should render a category filter dropdown with 'All categories' as the default", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const filter = await screen.findByDisplayValue("All categories");
    expect(filter.tagName).toBe("SELECT");
  });

  it("should populate the category filter with all loaded categories", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const filter = await screen.findByDisplayValue("All categories");
    const options = within(filter).getAllByRole("option");

    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("All categories");
    expect(options[1]).toHaveTextContent("Groceries");
    expect(options[2]).toHaveTextContent("Transport");
  });

  it("should filter transactions to show only the selected category", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Beta");

    const filter = screen.getByDisplayValue("All categories");
    await user.selectOptions(filter, "cat-2");

    expect(within(table).queryByText("Alpha")).not.toBeInTheDocument();
    expect(within(table).getByText("Beta")).toBeInTheDocument();
    expect(within(table).queryByText("Gamma")).not.toBeInTheDocument();
  });

  it("should show all transactions when 'All categories' is re-selected", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Beta");

    const filter = screen.getByDisplayValue("All categories");
    await user.selectOptions(filter, "cat-2");
    await user.selectOptions(filter, "");

    expect(within(table).getByText("Alpha")).toBeInTheDocument();
    expect(within(table).getByText("Beta")).toBeInTheDocument();
    expect(within(table).getByText("Gamma")).toBeInTheDocument();
  });
});

describe("[Component] transactions page — date range filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should filter out transactions before the From date", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });

    expect(within(table).queryByText("Alpha")).not.toBeInTheDocument();
    expect(within(table).getByText("Beta")).toBeInTheDocument();
    expect(within(table).getByText("Gamma")).toBeInTheDocument();
  });

  it("should filter out transactions after the To date", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Gamma");

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-10" } });

    expect(within(table).getByText("Alpha")).toBeInTheDocument();
    expect(within(table).queryByText("Beta")).not.toBeInTheDocument();
    expect(within(table).queryByText("Gamma")).not.toBeInTheDocument();
  });

  it("should filter transactions within both From and To date range", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-18" } });

    expect(within(table).queryByText("Alpha")).not.toBeInTheDocument();
    expect(within(table).getByText("Beta")).toBeInTheDocument();
    expect(within(table).queryByText("Gamma")).not.toBeInTheDocument();
  });

  it("should include transactions on the exact From boundary date", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-05" } });

    expect(within(table).getByText("Alpha")).toBeInTheDocument();
  });

  it("should include transactions on the exact To boundary date", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Gamma");

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-20" } });

    expect(within(table).getByText("Gamma")).toBeInTheDocument();
  });

  it("should show 'No transactions match your filters.' when all are filtered out by date", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-25" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-28" } });

    expect(screen.getByText("No transactions match your filters.")).toBeInTheDocument();
  });

  it("should show 'No transactions found for this month.' when there are no transactions at all", async () => {
    stubFetch(defaultCategories, []);
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    expect(screen.getByText("No transactions found for this month.")).toBeInTheDocument();
  });
});

describe("[Component] transactions page — clear filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should not show the Clear filters button when no filters are active", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    await screen.findByRole("table");

    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("should show the Clear filters button when a category filter is active", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByRole("table");

    const filter = await screen.findByDisplayValue("All categories");
    await user.selectOptions(filter, "cat-1");

    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("should show the Clear filters button when a date filter is active", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    await screen.findByRole("table");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });

    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("should clear all filters and show all transactions when Clear filters is clicked", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    await user.selectOptions(screen.getByDisplayValue("All categories"), "cat-2");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(within(table).getByText("Alpha")).toBeInTheDocument();
    expect(within(table).getByText("Beta")).toBeInTheDocument();
    expect(within(table).getByText("Gamma")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});

describe("[Component] transactions page — remember form values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should focus the category field after categories load", async () => {
    stubFetch(defaultCategories, []);
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await waitFor(() => {
      expect(getAddFormCategory(form)).toHaveFocus();
    });
  });

  it("should remember the transaction date after a successful submission", async () => {
    stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByPlaceholderText("0.00"), "25.50");

    const dateInput = getAddFormDateInput(form);
    fireEvent.change(dateInput, { target: { value: "2026-03-15" } });

    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      expect(getAddFormDateInput(form).value).toBe("2026-03-15");
    });
  });

  it("should submit multiple amount rows as line items", async () => {
    const fetchMock = stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByLabelText("Amount 1"), "5.25");
    await user.click(within(form).getByRole("button", { name: "Add amount" }));
    await user.type(within(form).getByLabelText("Amount 2"), "4.50");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit?]) =>
          typeof call[0] === "string" &&
          call[0] === "/api/transactions" &&
          call[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
      expect(body.lineItems).toEqual([{ amount: 5.25 }, { amount: 4.5 }]);
    });
  });

  it("should normalize a shorthand date before submitting", async () => {
    const fetchMock = stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByPlaceholderText("0.00"), "25.50");
    await user.clear(getAddFormDateInput(form));
    await user.type(getAddFormDateInput(form), "31/3");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit?]) =>
          typeof call[0] === "string" &&
          call[0] === "/api/transactions" &&
          call[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
      expect(body.transactionDate).toBe("2026-03-31T00:00:00.000Z");
    });

    expect(getAddFormDateInput(form).value).toBe("2026-03-31");
  });

  it("should apply a relative date once when submitting", async () => {
    const fetchMock = stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    fireEvent.change(getAddFormDateInput(form), { target: { value: "2026-03-15" } });
    fireEvent.blur(getAddFormDateInput(form));

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByPlaceholderText("0.00"), "25.50");
    await user.clear(getAddFormDateInput(form));
    await user.type(getAddFormDateInput(form), "+1");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit?]) =>
          typeof call[0] === "string" &&
          call[0] === "/api/transactions" &&
          call[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
      expect(body.transactionDate).toBe("2026-03-16T00:00:00.000Z");
    });

    expect(getAddFormDateInput(form).value).toBe("2026-03-16");
  });

  it("should clear the amount after a successful submission", async () => {
    stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByPlaceholderText("0.00"), "25.50");

    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      expect((within(form).getByPlaceholderText("0.00") as HTMLInputElement).value).toBe("");
    });
  });

  it("should return focus to category after a successful submission", async () => {
    stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByPlaceholderText("0.00"), "25.50");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      expect(getAddFormCategory(form)).toHaveFocus();
    });
  });

  it("should focus the first invalid field when submission fails validation", async () => {
    stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      expect(getAddFormCategory(form)).toHaveFocus();
    });
  });
});

describe("[Component] transactions page — vendor autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should load and render vendor suggestions when the field is focused", async () => {
    const fetchMock = stubFetch(defaultCategories, [], ["Tesco", "Trainline"]);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const vendorInput = screen.getByLabelText("Vendor");

    await user.click(vendorInput);

    await screen.findByRole("option", { name: "Tesco" });
    expect(screen.getByRole("option", { name: "Trainline" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/vendors?", {
      cache: "no-store",
    });
  });

  it("should select a vendor suggestion with the keyboard", async () => {
    stubFetch(defaultCategories, [], ["Tesco", "Trainline"]);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const vendorInput = screen.getByLabelText("Vendor");

    await user.click(vendorInput);
    await screen.findByRole("option", { name: "Tesco" });

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(vendorInput).toHaveValue("Tesco");
    });

    expect(screen.queryByRole("option", { name: "Tesco" })).not.toBeInTheDocument();
  });

  it("should keep other form fields unchanged when a vendor suggestion is selected", async () => {
    stubFetch(defaultCategories, [], ["Tesco"]);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();
    const categorySelect = getAddFormCategory(form);
    const amountInput = within(form).getByPlaceholderText("0.00");
    const dateInput = getAddFormDateInput(form);
    const descriptionInput = within(form).getAllByPlaceholderText("Optional")[1];
    const vendorInput = screen.getByLabelText("Vendor");

    await user.selectOptions(categorySelect, "cat-2");
    await user.type(amountInput, "12.34");
    fireEvent.change(dateInput, { target: { value: "2026-03-22" } });
    await user.type(descriptionInput, "Bus fare");
    await user.click(vendorInput);
    await screen.findByRole("option", { name: "Tesco" });
    await user.click(screen.getByRole("option", { name: "Tesco" }));

    expect(categorySelect).toHaveValue("cat-2");
    expect(amountInput).toHaveValue(12.34);
    expect(dateInput).toHaveValue("2026-03-22");
    expect(descriptionInput).toHaveValue("Bus fare");
    expect(vendorInput).toHaveValue("Tesco");
  });

  it("should allow free-text vendor submission without selecting a suggestion", async () => {
    const fetchMock = stubFetch(defaultCategories, [], []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByPlaceholderText("0.00"), "25.50");
    await user.type(screen.getByLabelText("Vendor"), "New Cafe");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit?]) =>
          typeof call[0] === "string" &&
          call[0] === "/api/transactions" &&
          call[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
      expect(body.vendor).toBe("New Cafe");
    });
  });

  it("should close vendor suggestions when escape is pressed", async () => {
    stubFetch(defaultCategories, [], ["Tesco"]);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const vendorInput = screen.getByLabelText("Vendor");

    await user.click(vendorInput);
    await screen.findByRole("option", { name: "Tesco" });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "Tesco" })).not.toBeInTheDocument();
    });
  });

  it("should close vendor suggestions when the field loses focus", async () => {
    stubFetch(defaultCategories, [], ["Tesco"]);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();
    const vendorInput = screen.getByLabelText("Vendor");

    await user.click(vendorInput);
    await screen.findByRole("option", { name: "Tesco" });
    await user.click(getAddFormCategory(form));

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "Tesco" })).not.toBeInTheDocument();
    });
  });
});

describe("[Component] transactions page — date controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should normalize shorthand text dates on blur", async () => {
    stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    const dateInput = getAddFormDateInput(form);
    await user.clear(dateInput);
    await user.type(dateInput, "31/3");
    fireEvent.blur(dateInput);

    await waitFor(() => {
      expect(dateInput.value).toBe("2026-03-31");
    });
  });

  it("should apply a relative date once on blur using the last absolute date", async () => {
    stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    const dateInput = getAddFormDateInput(form);
    await user.clear(dateInput);
    await user.type(dateInput, "2026-03-15");
    fireEvent.blur(dateInput);

    await user.clear(dateInput);
    await user.type(dateInput, "+1");
    fireEvent.blur(dateInput);

    await waitFor(() => {
      expect(dateInput.value).toBe("2026-03-16");
    });
  });

  it("should support today and yesterday shorthand", async () => {
    stubFetch(defaultCategories, []);
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();
    const dateInput = getAddFormDateInput(form);

    await act(async () => {
      fireEvent.change(dateInput, { target: { value: "t" } });
      fireEvent.blur(dateInput);
    });
    const todayValue = dateInput.value;

    await act(async () => {
      fireEvent.change(dateInput, { target: { value: "y" } });
      fireEvent.blur(dateInput);
    });

    expect(dateInput.value).not.toBe(todayValue);
  });

  it("should move the date by one day with Arrow Up and Arrow Down", async () => {
    stubFetch(defaultCategories, []);
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    const dateInput = getAddFormDateInput(form);
    fireEvent.change(dateInput, { target: { value: "2026-03-15" } });
    dateInput.focus();

    await act(async () => {
      fireEvent.keyDown(dateInput, { key: "ArrowUp" });
    });
    expect(dateInput.value).toBe("2026-03-16");

    await act(async () => {
      fireEvent.keyDown(dateInput, { key: "ArrowDown" });
    });
    expect(dateInput.value).toBe("2026-03-15");
  });

  it("should use the last absolute date when nudging a relative shortcut", async () => {
    stubFetch(defaultCategories, []);
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    const dateInput = getAddFormDateInput(form);
    fireEvent.change(dateInput, { target: { value: "2026-03-15" } });
    fireEvent.blur(dateInput);
    fireEvent.change(dateInput, { target: { value: "+1" } });
    dateInput.focus();

    await act(async () => {
      fireEvent.keyDown(dateInput, { key: "ArrowUp" });
    });

    expect(dateInput.value).toBe("2026-03-16");
  });

  it("should move the date by one week with Shift+Arrow Up and Down", async () => {
    stubFetch(defaultCategories, []);
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    const dateInput = getAddFormDateInput(form);
    fireEvent.change(dateInput, { target: { value: "2026-03-15" } });
    dateInput.focus();

    await act(async () => {
      fireEvent.keyDown(dateInput, { key: "ArrowUp", shiftKey: true });
    });
    expect(dateInput.value).toBe("2026-03-22");

    await act(async () => {
      fireEvent.keyDown(dateInput, { key: "ArrowDown", shiftKey: true });
    });
    expect(dateInput.value).toBe("2026-03-15");
  });

  it("should show a validation error for an invalid text date", async () => {
    stubFetch(defaultCategories, []);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");
    const form = getAddTransactionForm();

    await user.selectOptions(getAddFormCategory(form), "cat-1");
    await user.type(within(form).getByPlaceholderText("0.00"), "25.50");
    await user.clear(getAddFormDateInput(form));
    await user.type(getAddFormDateInput(form), "31/31");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(await screen.findByText("Enter a valid date")).toBeInTheDocument();
    expect(getAddFormDateInput(form)).toHaveFocus();
  });
});

describe("[Component] transactions page — autofill prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should have autofill prevention attributes on the add transaction form and date input", async () => {
    stubFetch(defaultCategories, []);
    render(<TransactionsPage />);

    await screen.findByText("No transactions found for this month.");

    const form = getAddTransactionForm();
    expect(form).toHaveAttribute("data-form-type", "other");
    expect(form).toHaveAttribute("autocomplete", "off");

    const dateInput = getAddFormDateInput(form);
    expect(dateInput).toHaveAttribute("autocomplete", "off");
    expect(dateInput).toHaveAttribute("data-form-type", "other");
    expect(dateInput).not.toHaveAttribute("inputmode", "numeric");
  });

  it("should have autofill prevention attributes on the edit form and date input", async () => {
    stubFetch(defaultCategories, [singleTransaction]);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    const row = within(table).getByText("42.50").closest("tr")!;
    await user.click(row);

    const editForm = screen.getByRole("button", { name: "Save" }).closest("form")!;
    expect(editForm).toHaveAttribute("data-form-type", "other");
    expect(editForm).toHaveAttribute("autocomplete", "off");

    const editDateInput = screen.getByDisplayValue("2026-03-10");
    expect(editDateInput).toHaveAttribute("autocomplete", "off");
    expect(editDateInput).toHaveAttribute("data-form-type", "other");
  });
});

describe("[Component] transactions page — month change resets date filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should reset date filters when the month is changed", async () => {
    stubFetch(defaultCategories, multiTransactions);
    render(<TransactionsPage />);

    await screen.findByRole("table");

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    const toInput = screen.getByLabelText("To") as HTMLInputElement;

    fireEvent.change(fromInput, { target: { value: "2026-03-10" } });
    fireEvent.change(toInput, { target: { value: "2026-03-20" } });

    expect(fromInput.value).toBe("2026-03-10");
    expect(toInput.value).toBe("2026-03-20");

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-04" } });
    });

    expect(fromInput.value).toBe("");
    expect(toInput.value).toBe("");
  });

  it("should not reset the category filter when the month is changed", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await screen.findByRole("table");

    const categoryFilter = await screen.findByDisplayValue("All categories") as HTMLSelectElement;
    await user.selectOptions(categoryFilter, "cat-1");

    expect(categoryFilter.value).toBe("cat-1");

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-04" } });
    });

    expect(categoryFilter.value).toBe("cat-1");
  });
});

describe("[Component] transactions page — combined filters and sort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should apply both category and date filters simultaneously", async () => {
    stubFetch(defaultCategories, multiTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    // Groceries (cat-1) = Alpha (Mar 5) and Gamma (Mar 20)
    await user.selectOptions(screen.getByDisplayValue("All categories"), "cat-1");
    // From Mar 10 excludes Alpha
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });

    expect(within(table).queryByText("Alpha")).not.toBeInTheDocument();
    expect(within(table).queryByText("Beta")).not.toBeInTheDocument();
    expect(within(table).getByText("Gamma")).toBeInTheDocument();
  });

  it("should sort filtered results correctly", async () => {
    const fourTransactions = [
      ...multiTransactions,
      buildTransaction({
        id: "txn-d",
        categoryId: "cat-1",
        amount: "40.00",
        transactionDate: "2026-03-10T00:00:00.000Z",
        vendor: "Delta",
        category: { id: "cat-1", name: "Groceries", colorCode: "#22c55e" },
      }),
    ];

    stubFetch(defaultCategories, fourTransactions);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const table = await screen.findByRole("table");
    await within(table).findByText("Alpha");

    // Filter to Groceries: Alpha (Mar 5), Delta (Mar 10), Gamma (Mar 20)
    await user.selectOptions(screen.getByDisplayValue("All categories"), "cat-1");

    // Default desc: Gamma, Delta, Alpha
    let html = table.innerHTML;
    expect(html.indexOf("Gamma")).toBeLessThan(html.indexOf("Delta"));
    expect(html.indexOf("Delta")).toBeLessThan(html.indexOf("Alpha"));

    // Toggle to asc: Alpha, Delta, Gamma
    await user.click(within(table).getByRole("button", { name: /Date/ }));

    html = table.innerHTML;
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Delta"));
    expect(html.indexOf("Delta")).toBeLessThan(html.indexOf("Gamma"));
  });
});
