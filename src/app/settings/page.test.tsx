// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const defaultSettingsData = {
  id: 1,
  currency: "GBP",
  locale: "en-GB",
  monthlyBudgetTotal: null,
  updatedAt: "2026-03-10T00:00:00.000Z",
};

const defaultCategoriesData = [
  {
    id: "category-1",
    name: "Groceries",
    colorCode: "#22c55e",
    isSystem: true,
    createdAt: "2026-03-01T00:00:00.000Z",
    transactionCount: 2,
    budgetCount: 1,
  },
  {
    id: "category-2",
    name: "Utilities",
    colorCode: "#334455",
    isSystem: false,
    createdAt: "2026-03-02T00:00:00.000Z",
    transactionCount: 0,
    budgetCount: 0,
  },
];

type MockOptions = {
  settingsGet?: Response | Error;
  settingsPut?: ((body: Record<string, unknown>) => Response | Promise<Response>) | Response | Error;
  categoriesGet?:
    | ((categories: typeof defaultCategoriesData) => Response | Promise<Response>)
    | Response
    | Error;
  categoriesPost?:
    | ((body: Record<string, unknown>, categories: typeof defaultCategoriesData) => Response | Promise<Response>)
    | Response
    | Error;
  categoryPut?:
    | ((id: string, body: Record<string, unknown>, categories: typeof defaultCategoriesData) => Response | Promise<Response>)
    | Response
    | Error;
  categoryDelete?:
    | ((id: string, categories: typeof defaultCategoriesData) => Response | Promise<Response>)
    | Response
    | Error;
  initialCategories?: typeof defaultCategoriesData;
};

function createFetchMock(options: MockOptions = {}) {
  let categories = [...(options.initialCategories ?? defaultCategoriesData)];

  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.pathname
          : new URL(input.url).pathname;
    const method = init?.method ?? "GET";

    if (url === "/api/settings" && method === "GET") {
      if (options.settingsGet instanceof Error) {
        throw options.settingsGet;
      }

      return options.settingsGet ?? jsonResponse(defaultSettingsData);
    }

    if (url === "/api/settings" && method === "PUT") {
      const body = JSON.parse((init?.body as string | undefined) ?? "{}") as Record<
        string,
        unknown
      >;

      if (options.settingsPut instanceof Error) {
        throw options.settingsPut;
      }

      if (typeof options.settingsPut === "function") {
        return options.settingsPut(body);
      }

      return options.settingsPut ?? jsonResponse(defaultSettingsData);
    }

    if (url === "/api/categories" && method === "GET") {
      if (options.categoriesGet instanceof Error) {
        throw options.categoriesGet;
      }

      if (typeof options.categoriesGet === "function") {
        return options.categoriesGet(categories);
      }

      return options.categoriesGet ?? jsonResponse(categories);
    }

    if (url === "/api/categories" && method === "POST") {
      const body = JSON.parse((init?.body as string | undefined) ?? "{}") as Record<
        string,
        unknown
      >;

      if (options.categoriesPost instanceof Error) {
        throw options.categoriesPost;
      }

      if (typeof options.categoriesPost === "function") {
        return options.categoriesPost(body, categories);
      }

      const createdCategory = {
        id: `category-${categories.length + 1}`,
        name: String(body.name),
        colorCode: body.colorCode === null ? null : String(body.colorCode),
        isSystem: false,
        createdAt: "2026-03-15T00:00:00.000Z",
        transactionCount: 0,
        budgetCount: 0,
      };
      categories = [...categories, createdCategory];
      return options.categoriesPost ?? jsonResponse(createdCategory, 201);
    }

    if (url.startsWith("/api/categories/") && method === "PUT") {
      const id = url.split("/").pop()!;
      const body = JSON.parse((init?.body as string | undefined) ?? "{}") as Record<
        string,
        unknown
      >;

      if (options.categoryPut instanceof Error) {
        throw options.categoryPut;
      }

      if (typeof options.categoryPut === "function") {
        return options.categoryPut(id, body, categories);
      }

      categories = categories.map((category) =>
        category.id === id
          ? {
              ...category,
              name: String(body.name ?? category.name),
              colorCode:
                body.colorCode === undefined
                  ? category.colorCode
                  : body.colorCode === null
                    ? null
                    : String(body.colorCode),
            }
          : category,
      );

      return options.categoryPut ?? jsonResponse(categories.find((category) => category.id === id));
    }

    if (url.startsWith("/api/categories/") && method === "DELETE") {
      const id = url.split("/").pop()!;

      if (options.categoryDelete instanceof Error) {
        throw options.categoryDelete;
      }

      if (typeof options.categoryDelete === "function") {
        return options.categoryDelete(id, categories);
      }

      categories = categories.filter((category) => category.id !== id);
      return options.categoryDelete ?? new Response(null, { status: 204 });
    }

    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
}

async function waitForPageToLoad() {
  await waitFor(() => {
    expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
  });
}

describe("[Component] settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should show loading state while settings and categories are being fetched", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  it("should render settings values and category usage details when the page loads successfully", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<SettingsPage />);

    await waitForPageToLoad();

    expect(screen.getByPlaceholderText("GBP")).toHaveValue("GBP");
    expect(screen.getByPlaceholderText("en-GB")).toHaveValue("en-GB");
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("2 transactions • 1 budget")).toBeInTheDocument();
    expect(screen.getByText("Unused")).toBeInTheDocument();
    expect(screen.getByText("Seeded")).toBeInTheDocument();
  });

  it("should keep default settings and show a category error when category loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        categoriesGet: jsonResponse({ error: "Failed to load categories" }, 500),
      }),
    );

    render(<SettingsPage />);

    await waitForPageToLoad();

    expect(screen.getByPlaceholderText("GBP")).toHaveValue("GBP");
    expect(screen.getByText("Failed to load categories")).toBeInTheDocument();
  });

  it("should still render categories when settings loading fails but categories load successfully", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        settingsGet: new Error("Settings request failed"),
      }),
    );

    render(<SettingsPage />);

    await waitForPageToLoad();

    expect(screen.getByPlaceholderText("GBP")).toHaveValue("GBP");
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Utilities")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load categories")).not.toBeInTheDocument();
  });

  it("should submit settings when the save succeeds", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitForPageToLoad();

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Settings saved successfully.")).toBeInTheDocument();
    });

    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PUT");
    expect(putCall).toBeDefined();
    expect(JSON.parse(putCall![1]!.body as string)).toMatchObject({
      currency: "GBP",
      locale: "en-GB",
      monthlyBudgetTotal: null,
    });
  });

  it("should show a settings error when the settings save fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        settingsPut: jsonResponse({ error: "Server error" }, 500),
      }),
    );

    render(<SettingsPage />);

    await waitForPageToLoad();
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("should create a category and refresh the list when a valid category is submitted", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock({
      initialCategories: [],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitForPageToLoad();
    await user.type(screen.getByPlaceholderText("New category"), "Insurance");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => {
      expect(screen.getByText("Category created.")).toBeInTheDocument();
    });

    expect(screen.getByText("Insurance")).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/categories" && call[1]?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall![1]!.body as string)).toEqual({
      name: "Insurance",
      colorCode: "#78716c",
    });
  });

  it("should show a category error when creating a category fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        categoriesPost: jsonResponse(
          { error: "A category with this name already exists" },
          409,
        ),
      }),
    );

    render(<SettingsPage />);

    await waitForPageToLoad();
    await user.type(screen.getByPlaceholderText("New category"), "Utilities");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => {
      expect(
        screen.getByText("A category with this name already exists"),
      ).toBeInTheDocument();
    });
  });

  it("should update an existing category when editing is submitted", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitForPageToLoad();
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]);

    const nameInput = screen.getByDisplayValue("Utilities");
    await user.clear(nameInput);
    await user.type(nameInput, "Bills");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Category updated.")).toBeInTheDocument();
    });

    expect(screen.getByText("Bills")).toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/categories/category-2" && call[1]?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse(putCall![1]!.body as string)).toEqual({
      name: "Bills",
      colorCode: "#334455",
    });
  });

  it("should delete an unused category when the delete action succeeds", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitForPageToLoad();
    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]);

    await waitFor(() => {
      expect(screen.getByText("Category deleted.")).toBeInTheDocument();
    });

    expect(screen.queryByText("Utilities")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        (call) => call[0] === "/api/categories/category-2" && call[1]?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("should disable delete when a category is already used by transactions or budgets", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<SettingsPage />);

    await waitForPageToLoad();
    expect(screen.getAllByRole("button", { name: "Delete" })[0]).toBeDisabled();
  });

  it("should show a category error when deleting a category fails on the server", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        categoryDelete: jsonResponse(
          { error: "Cannot delete a category that is used by transactions" },
          409,
        ),
      }),
    );

    render(<SettingsPage />);

    await waitForPageToLoad();
    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]);

    await waitFor(() => {
      expect(
        screen.getByText("Cannot delete a category that is used by transactions"),
      ).toBeInTheDocument();
    });
  });
});
