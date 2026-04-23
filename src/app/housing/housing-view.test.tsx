// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HousingView } from "@/app/housing/housing-view";

vi.mock("@/lib/months", () => ({
  getCurrentMonthValue: () => "2026-03",
  formatMonthLabel: (month: string) => {
    if (month === "2026-02") {
      return "February 2026";
    }

    if (month === "2026-04") {
      return "April 2026";
    }

    return "March 2026";
  },
  shiftMonthValue: (month: string, delta: number) => {
    const values: Record<string, Record<number, string>> = {
      "2026-02": { 1: "2026-03", [-1]: "2026-01" },
      "2026-03": { 1: "2026-04", [-1]: "2026-02" },
      "2026-04": { 1: "2026-05", [-1]: "2026-03" },
    };

    return values[month]?.[delta] ?? month;
  },
}));

type HousingExpenseFixture = {
  id: number;
  expenseType:
    | "RENT"
    | "COUNCIL_TAX"
    | "ENERGY"
    | "WATER"
    | "INTERNET"
    | "INSURANCE"
    | "MAINTENANCE"
    | "OTHER";
  amount: string;
  expenseMonth: string;
  frequency: "MONTHLY" | "YEARLY";
  createdAt: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildHousingExpense(
  overrides: Partial<HousingExpenseFixture> = {},
): HousingExpenseFixture {
  return {
    id: 1,
    expenseType: "RENT",
    amount: "1200",
    expenseMonth: "2026-03-01T00:00:00.000Z",
    frequency: "MONTHLY",
    createdAt: "2026-03-11T09:00:00.000Z",
    ...overrides,
  };
}

function renderHousingView() {
  return render(<HousingView />);
}

function getHousingCard(name: string) {
  const heading = screen.getByRole("heading", { name });
  const card = heading.closest("article");

  expect(card).not.toBeNull();

  return card as HTMLElement;
}

describe("[Component] housing view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should render housing summary cards and one card per expense type", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(
          jsonResponse([
            buildHousingExpense(),
            buildHousingExpense({
              id: 2,
              expenseType: "INSURANCE",
              amount: "120",
              frequency: "YEARLY",
            }),
          ]),
        );
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(
          jsonResponse([
            buildHousingExpense({
              id: 3,
              expenseType: "WATER",
              amount: "45",
            }),
          ]),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    expect(await screen.findByRole("heading", { name: "Housing costs" })).toBeInTheDocument();
    expect(
      within(screen.getByText("Housing Monthly").parentElement as HTMLElement).getByText(
        "£1,210.00",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText("Saved Types").parentElement as HTMLElement).getByText("2"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText("Yearly Items").parentElement as HTMLElement).getByText("1"),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("article")).toHaveLength(8);
    expect(screen.getByRole("heading", { name: "Rent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Council tax" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Other" })).toBeInTheDocument();
    expect(screen.getByText("Previous month: £45.00 / monthly")).toBeInTheDocument();
    expect(screen.getAllByText("No previous month value").length).toBeGreaterThan(0);
  });

  it("should keep edits local until Save is clicked", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/housing" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            buildHousingExpense({
              amount: "1300",
            }),
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    const rentCard = await waitFor(() => getHousingCard("Rent"));

    fireEvent.change(within(rentCard).getByLabelText("Amount"), {
      target: { value: "1300" },
    });

    expect(within(rentCard).getByText("Unsaved changes")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]) === "/api/housing" &&
          (call[1] as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);

    fireEvent.click(within(rentCard).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/housing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expenseType: "RENT",
          month: "2026-03",
          amount: "1300.00",
          frequency: "MONTHLY",
        }),
      });
    });

    expect(await within(rentCard).findByDisplayValue("1300.00")).toBeInTheDocument();
    expect(within(rentCard).getAllByText("Saved").length).toBeGreaterThan(0);
  });

  it("should reset local card changes without saving", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    const rentCard = await waitFor(() => getHousingCard("Rent"));

    fireEvent.change(within(rentCard).getByLabelText("Amount"), {
      target: { value: "1350" },
    });
    fireEvent.change(within(rentCard).getByLabelText("Frequency"), {
      target: { value: "YEARLY" },
    });

    fireEvent.click(within(rentCard).getByRole("button", { name: "Reset" }));

    expect(within(rentCard).getByDisplayValue("1200.00")).toBeInTheDocument();
    expect(within(rentCard).getByLabelText("Frequency")).toHaveValue("MONTHLY");
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]) === "/api/housing" &&
          (call[1] as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  it("should show validation feedback and keep Save disabled for invalid amounts", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    const rentCard = await waitFor(() => getHousingCard("Rent"));

    fireEvent.change(within(rentCard).getByLabelText("Amount"), {
      target: { value: "0" },
    });

    expect(
      within(rentCard).getByText("Enter an amount greater than 0"),
    ).toBeInTheDocument();
    expect(within(rentCard).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]) === "/api/housing" &&
          (call[1] as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  it("should update the monthly equivalent and yearly summary when a yearly item is saved", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/housing" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            buildHousingExpense({
              amount: "120",
              frequency: "YEARLY",
            }),
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    const rentCard = await waitFor(() => getHousingCard("Rent"));

    fireEvent.change(within(rentCard).getByLabelText("Amount"), {
      target: { value: "120" },
    });
    fireEvent.change(within(rentCard).getByLabelText("Frequency"), {
      target: { value: "YEARLY" },
    });

    expect(within(rentCard).getByText("£10.00")).toBeInTheDocument();

    fireEvent.click(within(rentCard).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/housing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expenseType: "RENT",
          month: "2026-03",
          amount: "120.00",
          frequency: "YEARLY",
        }),
      });
    });

    expect(
      within(screen.getByText("Housing Monthly").parentElement as HTMLElement).getByText(
        "£10.00",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText("Yearly Items").parentElement as HTMLElement).getByText("1"),
    ).toBeInTheDocument();
  });

  it("should clear a stored housing expense from its card", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/housing/1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    const rentCard = await waitFor(() => getHousingCard("Rent"));

    fireEvent.click(within(rentCard).getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/housing/1", {
        method: "DELETE",
      });
    });

    expect(await within(rentCard).findByText("No value saved")).toBeInTheDocument();
    expect(within(rentCard).getByDisplayValue("")).toBeInTheDocument();
  });

  it("should copy only missing housing values from the previous month", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(
          jsonResponse([
            buildHousingExpense(),
            buildHousingExpense({
              id: 2,
              expenseType: "WATER",
              amount: "45",
            }),
          ]),
        );
      }

      if (url === "/api/housing" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            buildHousingExpense({
              id: 3,
              expenseType: "WATER",
              amount: "45",
            }),
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    fireEvent.click(
      await screen.findByRole("button", { name: "Copy missing from February 2026" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/housing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expenseType: "WATER",
          month: "2026-03",
          amount: "45.00",
          frequency: "MONTHLY",
        }),
      });
    });

    const waterCard = getHousingCard("Water");
    expect(await within(waterCard).findByDisplayValue("45.00")).toBeInTheDocument();
  });

  it("should load the next month when the housing month picker advances", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03" || url === "/api/housing?month=2026-04") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderHousingView();

    await screen.findByText("Housing Expenses");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/housing?month=2026-04", {
        cache: "no-store",
      });
    });

    expect(screen.getAllByText("April 2026").length).toBeGreaterThan(0);
  });
});
