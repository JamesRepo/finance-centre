// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import AnalysisPage from "@/app/analysis/page";
import { SpendingTab } from "@/app/analysis/spending-tab";
import { BudgetTab } from "@/app/analysis/budget-tab";
import { IncomeTab } from "@/app/analysis/income-tab";
import { NetWorthTab } from "@/app/analysis/networth-tab";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="bar-chart">
      <div data-testid="bar-chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  LineChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="line-chart">
      <div data-testid="line-chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  AreaChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="area-chart">
      <div data-testid="area-chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  Bar: ({
    children,
    dataKey,
  }: {
    children?: React.ReactNode;
    dataKey: string;
  }) => <div data-testid={`bar-${dataKey}`}>{children}</div>,
  Line: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`line-${dataKey}`} />
  ),
  Area: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`area-${dataKey}`} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
  Cell: () => <div data-testid="cell" />,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children, data }: { children?: React.ReactNode; data: unknown[] }) => (
    <div data-testid="pie">
      <div data-testid="pie-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
}

// --- Page Shell Tests ---

describe("[Component] AnalysisPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-15T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("should render the page header with Insights eyebrow and Analysis title", () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    render(<AnalysisPage />);

    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Analysis" }),
    ).toBeInTheDocument();
  });

  it("should render all four section tabs", () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    render(<AnalysisPage />);

    expect(
      screen.getByRole("button", { name: "Spending Trends" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Budget Health" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Income & Outgoings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Net Worth" }),
    ).toBeInTheDocument();
  });

  it("should render all three range selector buttons", () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    render(<AnalysisPage />);

    expect(
      screen.getByRole("button", { name: "3 months" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "6 months" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "12 months" }),
    ).toBeInTheDocument();
  });

  it("should show loading state on initial render", () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    render(<AnalysisPage />);

    expect(screen.getByText("Loading analysis...")).toBeInTheDocument();
  });

  it("should show error state when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      }),
    );

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("should show generic error when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure")),
    );

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });
  });

  it("should fetch data with the default section and months on mount", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            monthlyTotals: [],
            stackedByMonth: [],
            top5Categories: [],
            hasOther: false,
            categoryChanges: [],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analysis?section=spending&months=6",
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });

  it("should refetch data when a different section tab is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const spendingPayload = {
      monthlyTotals: [],
      stackedByMonth: [],
      top5Categories: [],
      hasOther: false,
      categoryChanges: [],
    };
    const budgetPayload = {
      budgetHealth: [],
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(spendingPayload),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(budgetPayload),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Budget Health" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analysis?section=budgets&months=6",
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });

  it("should refetch data when a different range is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          monthlyTotals: [],
          stackedByMonth: [],
          top5Categories: [],
          hasOther: false,
          categoryChanges: [],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "12 months" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analysis?section=spending&months=12",
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });

  it("should show loading state when switching tabs before data arrives", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    let resolveFirst: (value: unknown) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalysisPage />);
    expect(screen.getByText("Loading analysis...")).toBeInTheDocument();

    // Resolve first fetch
    resolveFirst!({
      ok: true,
      json: () =>
        Promise.resolve({
          monthlyTotals: [],
          stackedByMonth: [],
          top5Categories: [],
          hasOther: false,
          categoryChanges: [],
        }),
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Loading analysis..."),
      ).not.toBeInTheDocument();
    });

    // Switch tabs — should show loading again since data.section won't match
    await user.click(screen.getByRole("button", { name: "Budget Health" }));

    await waitFor(() => {
      expect(screen.getByText("Loading analysis...")).toBeInTheDocument();
    });
  });

  it("should show the latest request error after a successful load", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            monthlyTotals: [],
            stackedByMonth: [],
            top5Categories: [],
            hasOther: false,
            categoryChanges: [],
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Budget request failed" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(
        screen.queryByText("Loading analysis..."),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Budget Health" }));

    await waitFor(() => {
      expect(screen.getByText("Budget request failed")).toBeInTheDocument();
    });

    expect(screen.queryByText("Loading analysis...")).not.toBeInTheDocument();
  });

  it("should ignore stale responses from older requests", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const firstRequest = createDeferred<{
      ok: boolean;
      json: () => Promise<{
        monthlyTotals: [];
        stackedByMonth: [];
        top5Categories: [];
        hasOther: false;
        categoryChanges: [];
      }>;
    }>();
    const secondRequest = createDeferred<{
      ok: boolean;
      json: () => Promise<{
        budgetHealth: Array<{
          month: string;
          totalSpent: number;
          totalBudgeted: number;
          utilisation: number;
          overBudgetCount: number;
        }>;
      }>;
    }>();

    const fetchMock = vi.fn()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalysisPage />);

    await user.click(screen.getByRole("button", { name: "Budget Health" }));

    secondRequest.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          budgetHealth: [
            {
              month: "2026-04",
              totalSpent: 800,
              totalBudgeted: 1000,
              utilisation: 80,
              overBudgetCount: 1,
            },
          ],
        }),
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Budget Utilisation" }),
      ).toBeInTheDocument();
    });

    firstRequest.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          monthlyTotals: [],
          stackedByMonth: [],
          top5Categories: [],
          hasOther: false,
          categoryChanges: [],
        }),
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Budget Utilisation" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("heading", { name: "Monthly Spending" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Loading analysis...")).not.toBeInTheDocument();
  });
});

// --- SpendingTab Tests ---

describe("[Component] SpendingTab", () => {
  it("should render Monthly Spending heading when data has entries", () => {
    render(
      <SpendingTab
        data={{
          monthlyTotals: [{ month: "2026-04", total: "100.00" }],
          stackedByMonth: [{ month: "2026-04" }],
          top5Categories: [],
          hasOther: false,
          categoryChanges: [],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Monthly Spending" }),
    ).toBeInTheDocument();
  });

  it("should show empty state when there are no monthly totals", () => {
    render(
      <SpendingTab
        data={{
          monthlyTotals: [],
          stackedByMonth: [],
          top5Categories: [],
          hasOther: false,
          categoryChanges: [],
        }}
      />,
    );

    expect(
      screen.getByText("No spending data found for this period."),
    ).toBeInTheDocument();
  });

  it("should render the Category Breakdown section when categories exist", () => {
    render(
      <SpendingTab
        data={{
          monthlyTotals: [{ month: "2026-04", total: "500.00" }],
          stackedByMonth: [{ month: "2026-04", Food: 300, Transport: 200 }],
          top5Categories: [
            { id: "1", name: "Food", colorCode: "#FF0000" },
            { id: "2", name: "Transport", colorCode: "#00FF00" },
          ],
          hasOther: false,
          categoryChanges: [],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Category Breakdown" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
  });

  it("should render the Biggest Category Changes section with up and down arrows", () => {
    render(
      <SpendingTab
        data={{
          monthlyTotals: [{ month: "2026-04", total: "500.00" }],
          stackedByMonth: [{ month: "2026-04" }],
          top5Categories: [],
          hasOther: false,
          categoryChanges: [
            {
              categoryId: "cat-1",
              categoryName: "Food",
              colorCode: "#FF0000",
              currentTotal: 300,
              priorTotal: 200,
              change: 100,
            },
            {
              categoryId: "cat-2",
              categoryName: "Transport",
              colorCode: "#00FF00",
              currentTotal: 50,
              priorTotal: 150,
              change: -100,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Biggest Category Changes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
    // Check arrow indicators are present
    expect(screen.getByText(/\u2191/)).toBeInTheDocument(); // up arrow
    expect(screen.getByText(/\u2193/)).toBeInTheDocument(); // down arrow
  });

  it("should not render the Category Changes section when there are no changes", () => {
    render(
      <SpendingTab
        data={{
          monthlyTotals: [{ month: "2026-04", total: "500.00" }],
          stackedByMonth: [{ month: "2026-04" }],
          top5Categories: [],
          hasOther: false,
          categoryChanges: [],
        }}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Biggest Category Changes" }),
    ).not.toBeInTheDocument();
  });
});

// --- BudgetTab Tests ---

describe("[Component] BudgetTab", () => {
  it("should render Budget Utilisation heading when data exists", () => {
    render(
      <BudgetTab
        data={{
          budgetHealth: [
            {
              month: "2026-04",
              totalSpent: 800,
              totalBudgeted: 1000,
              utilisation: 80,
              overBudgetCount: 1,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Budget Utilisation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Categories Over Budget" }),
    ).toBeInTheDocument();
  });

  it("should show empty state when budgetHealth is empty", () => {
    render(<BudgetTab data={{ budgetHealth: [] }} />);

    expect(
      screen.getByText("No budget data found for this period."),
    ).toBeInTheDocument();
  });

  it("should render descriptions for both widget sections", () => {
    render(
      <BudgetTab
        data={{
          budgetHealth: [
            {
              month: "2026-04",
              totalSpent: 500,
              totalBudgeted: 1000,
              utilisation: 50,
              overBudgetCount: 0,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText("Percentage of total budget spent each month"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Number of categories exceeding their budget each month",
      ),
    ).toBeInTheDocument();
  });
});

// --- IncomeTab Tests ---

describe("[Component] IncomeTab", () => {
  it("should render Income vs Outgoings heading when data exists", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            {
              month: "2026-04",
              grossIncome: 3000,
              income: 3000,
              outgoings: 2000,
              netPosition: 1000,
            },
          ],
          deductionBreakdown: [],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Income vs Outgoings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Net Position" }),
    ).toBeInTheDocument();
  });

  it("should show empty state when incomeVsOutgoings is empty", () => {
    render(<IncomeTab data={{ incomeVsOutgoings: [], deductionBreakdown: [] }} />);

    expect(
      screen.getByText("No income data found for this period."),
    ).toBeInTheDocument();
  });

  it("should render the Income and Outgoings legend items", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            {
              month: "2026-04",
              grossIncome: 3000,
              income: 3000,
              outgoings: 2000,
              netPosition: 1000,
            },
          ],
          deductionBreakdown: [],
        }}
      />,
    );

    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Outgoings")).toBeInTheDocument();
  });

  it("should render the surplus/deficit description", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            {
              month: "2026-04",
              grossIncome: 1000,
              income: 1000,
              outgoings: 1500,
              netPosition: -500,
            },
          ],
          deductionBreakdown: [],
        }}
      />,
    );

    expect(
      screen.getByText("Monthly surplus or deficit"),
    ).toBeInTheDocument();
  });

  it("should render the deductions donut chart when deduction data exists", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3700, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [
            { deductionType: "INCOME_TAX", total: 500 },
            { deductionType: "NI", total: 200 },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Income Deductions Breakdown" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Where your gross income goes before it reaches you"),
    ).toBeInTheDocument();
  });

  it("should not render deductions section when deductionBreakdown is empty", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3000, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [],
        }}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Income Deductions Breakdown" }),
    ).not.toBeInTheDocument();
  });

  it("should display total deductions amount in the donut center", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3700, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [
            { deductionType: "INCOME_TAX", total: 500 },
            { deductionType: "NI", total: 200 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("deduction-total")).toHaveTextContent("£700.00");
  });

  it("should render legend items for each deduction type", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3700, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [
            { deductionType: "INCOME_TAX", total: 500 },
            { deductionType: "NI", total: 200 },
            { deductionType: "PENSION", total: 150 },
          ],
        }}
      />,
    );

    // Each deduction type appears in both donut legends (deduction types + gross split)
    expect(screen.getAllByText("Income Tax")).toHaveLength(2);
    expect(screen.getAllByText("National Insurance")).toHaveLength(2);
    expect(screen.getAllByText("Pension")).toHaveLength(2);
  });

  it("should filter out zero-amount deduction entries", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3500, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [
            { deductionType: "INCOME_TAX", total: 500 },
            { deductionType: "NI", total: 0 },
          ],
        }}
      />,
    );

    // Income Tax appears in both donut legends (deduction types + gross split)
    expect(screen.getAllByText("Income Tax")).toHaveLength(2);
    expect(screen.queryByText("National Insurance")).not.toBeInTheDocument();
  });

  it("should render the gross income split donut when deduction data exists", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3700, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [
            { deductionType: "INCOME_TAX", total: 500 },
            { deductionType: "NI", total: 200 },
          ],
        }}
      />,
    );

    expect(screen.getByText("Gross Income Split")).toBeInTheDocument();
    expect(screen.getByText("Take-home")).toBeInTheDocument();
    // Individual deduction types appear in both donut legends
    expect(screen.getAllByText("Income Tax")).toHaveLength(2);
    expect(screen.getAllByText("National Insurance")).toHaveLength(2);
  });

  it("should display the gross income total in the gross donut center", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3500, income: 3000, outgoings: 2000, netPosition: 1000 },
            { month: "2026-03", grossIncome: 3000, income: 2800, outgoings: 1800, netPosition: 1000 },
          ],
          deductionBreakdown: [
            { deductionType: "INCOME_TAX", total: 500 },
            { deductionType: "NI", total: 200 },
          ],
        }}
      />,
    );

    // Gross uses stored gross totals (3500 + 3000) = 6500
    expect(screen.getByTestId("gross-total")).toHaveTextContent("£6,500.00");
  });

  it("should derive the gross split from stored gross income instead of net plus deductions", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 4000, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [
            { deductionType: "INCOME_TAX", total: 500 },
            { deductionType: "NI", total: 200 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("gross-total")).toHaveTextContent("£4,000.00");
    expect(screen.getAllByText("£3,300.00")).toHaveLength(1);
  });

  it("should not render the gross income split donut when there are no deductions", () => {
    render(
      <IncomeTab
        data={{
          incomeVsOutgoings: [
            { month: "2026-04", grossIncome: 3000, income: 3000, outgoings: 2000, netPosition: 1000 },
          ],
          deductionBreakdown: [],
        }}
      />,
    );

    expect(screen.queryByText("Gross Income Split")).not.toBeInTheDocument();
  });
});

// --- NetWorthTab Tests ---

describe("[Component] NetWorthTab", () => {
  it("should render all three section headings when data exists", () => {
    render(
      <NetWorthTab
        data={{
          netWorthByMonth: [
            {
              month: "2026-04",
              remainingDebt: 5000,
              totalSavings: 3000,
              netWorth: -2000,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Debt Paydown" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Savings Growth" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Net Worth" }),
    ).toBeInTheDocument();
  });

  it("should show empty state when netWorthByMonth is empty", () => {
    render(<NetWorthTab data={{ netWorthByMonth: [] }} />);

    expect(
      screen.getByText("No net worth data found for this period."),
    ).toBeInTheDocument();
  });

  it("should render descriptions for debt and savings sections", () => {
    render(
      <NetWorthTab
        data={{
          netWorthByMonth: [
            {
              month: "2026-04",
              remainingDebt: 5000,
              totalSavings: 3000,
              netWorth: -2000,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText("Remaining debt balance over time"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cumulative savings contributions over time"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Total savings minus total remaining debt"),
    ).toBeInTheDocument();
  });
});
