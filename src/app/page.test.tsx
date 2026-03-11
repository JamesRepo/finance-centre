// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

vi.mock("@/lib/months", () => ({
  getCurrentMonthValue: () => "2026-03",
  formatMonthLabel: (month: string) =>
    month === "2026-02" ? "February 2026" : "March 2026",
  shiftMonthValue: (month: string, delta: number) =>
    month === "2026-03" && delta === -1 ? "2026-02" : "2026-04",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: Array<{ categoryId: string; name: string }>;
  }) => (
    <div data-testid="bar-chart">
      <div>{data.map((entry) => entry.name).join(", ")}</div>
      <div data-testid="bar-chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const budgetsResponse = [
  {
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
    categoryId: "category-2",
    amount: "200",
    spent: "240",
    category: {
      id: "category-2",
      name: "Transport",
      colorCode: "#3b82f6",
    },
  },
];

describe("[Component] dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should fetch the current month and render summary stats when the page loads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(budgetsResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-03", {
      cache: "no-store",
    });
    expect(screen.getByText("March 2026")).toBeInTheDocument();
    expect(screen.getByText("£700.00")).toBeInTheDocument();
    expect(screen.getByText("£363.45")).toBeInTheDocument();
    expect(screen.getByText("£336.55")).toBeInTheDocument();
  });

  it("should keep the budget amount as the chart reference when spending exceeds budget", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(budgetsResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    const chartData = await screen.findByTestId("bar-chart-data");
    const parsedData = JSON.parse(chartData.textContent ?? "[]") as Array<{
      categoryId: string;
      budgetBarAmount: number;
      spentFillRatio: number;
    }>;
    const transport = parsedData.find((entry) => entry.categoryId === "category-2");

    expect(transport).toMatchObject({
      categoryId: "category-2",
      budgetBarAmount: 200,
      spentFillRatio: 1,
    });
  });

  it("should refetch data for the previous month when the previous button is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(budgetsResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(budgetsResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    await screen.findByText("Groceries, Transport");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/budgets?month=2026-02", {
        cache: "no-store",
      });
    });

    expect(screen.getByText("February 2026")).toBeInTheDocument();
  });

  it("should show an error message when the dashboard request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Budget API unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(
      await screen.findByText("Budget API unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });
});
