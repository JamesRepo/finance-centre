// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BudgetsPage from "@/app/budgets/page";

vi.mock("@/lib/months", () => ({
  getCurrentMonthValue: () => "2026-03",
  formatMonthLabel: (month: string) =>
    month === "2026-04" ? "April 2026" : "March 2026",
  shiftMonthValue: (month: string, delta: number) =>
    month === "2026-03" && delta === 1 ? "2026-04" : "2026-02",
}));

const initialBudgetsResponse = [
  {
    budgetId: "budget-1",
    categoryId: "category-1",
    amount: "500",
    spent: "123.45",
    category: {
      id: "category-1",
      name: "Groceries",
      colorCode: "#22c55e",
    },
  },
  {
    budgetId: null,
    categoryId: "category-2",
    amount: "0",
    spent: "40",
    category: {
      id: "category-2",
      name: "Transport",
      colorCode: "#3b82f6",
    },
  },
];

describe("[Component] budgets page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should load the selected month and render each category with its current spending", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(initialBudgetsResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetsPage />);

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
    expect(screen.getByText("Spent this month: £123.45")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.00")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-03", {
      cache: "no-store",
    });
  });

  it("should disable autofill on the budgets month picker", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(initialBudgetsResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetsPage />);

    expect(await screen.findByLabelText("Month")).toHaveAttribute("autocomplete", "off");
  });

  it("should load the next month when Next is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(initialBudgetsResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetsPage />);

    await screen.findByText("Groceries");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-04", {
        cache: "no-store",
      });
    });

    expect(screen.getByText("April 2026")).toBeInTheDocument();
  });

  it("should auto-save a changed budget on blur when the value is valid", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialBudgetsResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "budget-1",
            amount: "650",
            createdAt: "2026-03-11T12:30:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetsPage />);

    const input = await screen.findByDisplayValue("500.00");

    fireEvent.change(input, { target: { value: "650" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/budgets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          categoryId: "category-1",
          month: "2026-03",
          amount: "650.00",
        }),
      });
    });

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getByDisplayValue("650.00")).toBeInTheDocument();
  });

  it("should save a zero budget when the field is cleared before blur", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialBudgetsResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "budget-1",
            amount: "0",
            createdAt: "2026-03-11T12:30:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetsPage />);

    const input = await screen.findByDisplayValue("500.00");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/budgets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          categoryId: "category-1",
          month: "2026-03",
          amount: "0.00",
        }),
      });
    });

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("0.00")).toHaveLength(2);
  });

  it("should restore the original value and surface the API error when save fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialBudgetsResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Budget save failed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetsPage />);

    const input = await screen.findByDisplayValue("500.00");

    fireEvent.change(input, { target: { value: "650" } });
    fireEvent.blur(input);

    expect(await screen.findByText("Budget save failed")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500.00")).toBeInTheDocument();
  });
});
