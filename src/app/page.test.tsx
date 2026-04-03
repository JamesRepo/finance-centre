// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  XAxis: ({
    tick,
  }: {
    tick?: { fill?: string; fontSize?: number };
  }) => <div data-testid="x-axis-tick">{JSON.stringify(tick ?? {})}</div>,
  YAxis: ({
    tick,
  }: {
    tick?: { fill?: string; fontSize?: number };
  }) => <div data-testid="y-axis-tick">{JSON.stringify(tick ?? {})}</div>,
  Tooltip: ({
    cursor,
    contentStyle,
  }: {
    cursor?: { fill?: string };
    contentStyle?: { borderColor?: string; boxShadow?: string };
  }) => (
    <div
      data-testid="chart-tooltip"
      data-cursor-fill={cursor?.fill}
      data-border-color={contentStyle?.borderColor}
      data-box-shadow={contentStyle?.boxShadow}
    />
  ),
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
      showOnDashboardDailySpending: true,
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
      showOnDashboardDailySpending: true,
    },
  },
  {
    categoryId: "category-3",
    amount: "950",
    spent: "950",
    category: {
      id: "category-3",
      name: "Rent",
      colorCode: "#a855f7",
      showOnDashboardDailySpending: false,
    },
  },
];

const debtsResponse = [
  {
    id: 1,
    name: "Credit Card",
    originalBalance: "5000",
    isActive: true,
    currentBalance: "3500",
    principalPaid: "1500",
    debtPayments: [
      {
        id: 11,
        amount: "200",
        interestAmount: "20",
        paymentDate: "2026-03-10T00:00:00.000Z",
      },
      {
        id: 12,
        amount: "150",
        interestAmount: "15",
        paymentDate: "2026-02-12T00:00:00.000Z",
      },
    ],
  },
  {
    id: 2,
    name: "Student Loan",
    originalBalance: "20000",
    isActive: true,
    currentBalance: "12000",
    principalPaid: "8000",
    debtPayments: [
      {
        id: 21,
        amount: "100",
        interestAmount: "0",
        paymentDate: "2026-03-22T00:00:00.000Z",
      },
    ],
  },
  {
    id: 3,
    name: "Old Car Loan",
    originalBalance: "10000",
    isActive: false,
    currentBalance: "0",
    principalPaid: "10000",
    debtPayments: [],
  },
];

const savingsResponse = [
  {
    id: 1,
    name: "Emergency Fund",
    targetAmount: "10000",
    currentAmount: "4500",
    progress: "45",
  },
  {
    id: 2,
    name: "Holiday Pot",
    targetAmount: "2000",
    currentAmount: "800",
    progress: "40",
  },
];

const housingResponse = [
  { id: 1, expenseType: "RENT", amount: "950", frequency: "MONTHLY" },
  { id: 2, expenseType: "ENERGY", amount: "120", frequency: "MONTHLY" },
];

const subscriptionsResponse = {
  month: "2026-03",
  subscriptions: [
    {
      id: 1,
      name: "Netflix",
      amount: "15.99",
      frequency: "MONTHLY",
      monthlyEquivalent: "15.99",
    },
    {
      id: 2,
      name: "Gym",
      amount: "360",
      frequency: "YEARLY",
      monthlyEquivalent: "30",
    },
  ],
  total: "375.99",
  monthlyEquivalentTotal: "45.99",
};

const holidaysResponse = [
  {
    id: 1,
    name: "Japan Spring",
    destination: "Tokyo",
    isActive: true,
    assignedMonth: "2026-03",
    totalCost: "1200",
    monthlyCost: "1200",
  },
  {
    id: 2,
    name: "Past Weekend",
    destination: "Lisbon",
    isActive: true,
    assignedMonth: "2026-03",
    totalCost: "400",
    monthlyCost: "400",
  },
  {
    id: 3,
    name: "Inactive Break",
    destination: "Rome",
    isActive: false,
    assignedMonth: "2026-03",
    totalCost: "100",
    monthlyCost: "100",
  },
];

const incomeResponse = [
  { id: 1, netAmount: "3200" },
  { id: 2, netAmount: "500" },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createFetchMock({
  budgets = budgetsResponse,
  debts = debtsResponse,
  savings = savingsResponse,
  housing = housingResponse,
  subscriptions = subscriptionsResponse,
  holidays = holidaysResponse,
  income = incomeResponse,
  budgetsStatus = 200,
  debtsStatus = 200,
  savingsStatus = 200,
  housingStatus = 200,
  subscriptionsStatus = 200,
  holidaysStatus = 200,
  incomeStatus = 200,
}: {
  budgets?: unknown;
  debts?: unknown;
  savings?: unknown;
  housing?: unknown;
  subscriptions?: unknown;
  holidays?: unknown;
  income?: unknown;
  budgetsStatus?: number;
  debtsStatus?: number;
  savingsStatus?: number;
  housingStatus?: number;
  subscriptionsStatus?: number;
  holidaysStatus?: number;
  incomeStatus?: number;
} = {}) {
  return vi.fn((url: string) => {
    if (url.startsWith("/api/budgets")) {
      return Promise.resolve(jsonResponse(budgets, budgetsStatus));
    }
    if (url === "/api/debts") {
      return Promise.resolve(jsonResponse(debts, debtsStatus));
    }
    if (url === "/api/savings") {
      return Promise.resolve(jsonResponse(savings, savingsStatus));
    }
    if (url.startsWith("/api/housing")) {
      return Promise.resolve(jsonResponse(housing, housingStatus));
    }
    if (url.startsWith("/api/subscriptions")) {
      return Promise.resolve(jsonResponse(subscriptions, subscriptionsStatus));
    }
    if (url.startsWith("/api/holidays")) {
      return Promise.resolve(jsonResponse(holidays, holidaysStatus));
    }
    if (url.startsWith("/api/income")) {
      return Promise.resolve(jsonResponse(income, incomeStatus));
    }
    return Promise.resolve(jsonResponse({ error: "Not found" }, 404));
  });
}

describe("[Component] dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should fetch the current month and render the redesigned sections when the page loads", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect((await screen.findAllByText("Groceries, Transport")).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-03", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/housing?month=2026-03", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/holidays?month=2026-03", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/income?month=2026-03", {
      cache: "no-store",
    });
    expect(screen.getByText("Monthly Overview")).toBeInTheDocument();
    expect(screen.getByText("Daily Spending")).toBeInTheDocument();
    expect(screen.getByText("Fixed Costs")).toBeInTheDocument();
    expect(screen.getByText("Holidays")).toBeInTheDocument();
    expect(screen.getByText("Monthly Summary")).toBeInTheDocument();
  });

  it("should disable autofill on the dashboard month picker", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByLabelText("Month")).toHaveAttribute("autocomplete", "off");
  });

  it("should filter the chart to daily categories and calculate daily totals when fixed-cost categories are present", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect((await screen.findAllByText("Groceries, Transport")).length).toBeGreaterThan(0);

    const chartData = JSON.parse(
      screen.getByTestId("bar-chart-data").textContent ?? "[]",
    ) as Array<{ name: string }>;
    const dailySection = screen.getByText("Daily Spending").closest("section");

    expect(chartData.map((entry) => entry.name)).toEqual(["Groceries", "Transport"]);
    expect(dailySection).not.toBeNull();
    expect(within(dailySection as HTMLElement).getAllByText("£363.45")).toHaveLength(2);
    expect(within(dailySection as HTMLElement).getByText("£700.00")).toBeInTheDocument();
    expect(within(dailySection as HTMLElement).getByText("Remaining £336.55")).toBeInTheDocument();
  });

  it("should sort configured daily categories alphabetically and reflect the selected names in the summary card", async () => {
    const fetchMock = createFetchMock({
      budgets: [
        {
          categoryId: "category-2",
          amount: "200",
          spent: "50",
          category: {
            id: "category-2",
            name: "Transport",
            colorCode: "#3b82f6",
            showOnDashboardDailySpending: true,
          },
        },
        {
          categoryId: "category-1",
          amount: "500",
          spent: "123.45",
          category: {
            id: "category-1",
            name: "Groceries",
            colorCode: "#22c55e",
            showOnDashboardDailySpending: true,
          },
        },
        {
          categoryId: "category-4",
          amount: "120",
          spent: "60",
          category: {
            id: "category-4",
            name: "Eating Out",
            colorCode: "#f59e0b",
            showOnDashboardDailySpending: true,
          },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(
      (await screen.findAllByText("Eating Out, Groceries, Transport")).length,
    ).toBeGreaterThan(0);

    const chartData = JSON.parse(
      screen.getByTestId("bar-chart-data").textContent ?? "[]",
    ) as Array<{ name: string }>;

    expect(chartData.map((entry) => entry.name)).toEqual([
      "Eating Out",
      "Groceries",
      "Transport",
    ]);
    expect(screen.getAllByText("Eating Out, Groceries, Transport")).toHaveLength(2);
  });

  it("should use theme tokens for chart axis and tooltip colors when the daily chart renders", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect((await screen.findAllByText("Groceries, Transport")).length).toBeGreaterThan(0);

    expect(screen.getByTestId("x-axis-tick")).toHaveTextContent(
      JSON.stringify({ fill: "var(--chart-axis-muted)", fontSize: 12 }),
    );
    expect(screen.getByTestId("y-axis-tick")).toHaveTextContent(
      JSON.stringify({ fill: "var(--chart-axis)", fontSize: 13 }),
    );
    expect(screen.getByTestId("chart-tooltip")).toHaveAttribute(
      "data-cursor-fill",
      "var(--chart-cursor)",
    );
  });

  it("should render fixed costs holidays debt savings and monthly summary totals when data loads", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    await screen.findByText("Japan Spring");

    expect(screen.getByText("£1,070.00")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByText("£45.99")).toBeInTheDocument();
    expect(screen.getByText("Netflix (Monthly)")).toBeInTheDocument();
    expect(screen.getByText("Gym (Yearly)")).toBeInTheDocument();

    expect(screen.getByText("Tokyo")).toBeInTheDocument();
    expect(screen.getByText("£1,200.00")).toBeInTheDocument();
    expect(screen.getByText("Past Weekend")).toBeInTheDocument();
    expect(screen.getByText("Inactive Break")).toBeInTheDocument();

    expect(screen.getByText("£15,500.00")).toBeInTheDocument();
    expect(screen.getByText("Credit Card")).toBeInTheDocument();
    expect(screen.queryByText("Old Car Loan")).not.toBeInTheDocument();
    expect(screen.getByText("£5,300.00")).toBeInTheDocument();
    expect(screen.getByText("Holiday Pot")).toBeInTheDocument();

    expect(screen.getByText("Total spent across everything")).toBeInTheDocument();
    expect(screen.getAllByText("£3,479.44")).toHaveLength(2);
    const breakdownTrigger = screen.getByText("View total breakdown");
    fireEvent.click(breakdownTrigger);
    const breakdownPanel = breakdownTrigger.closest("details");
    expect(breakdownPanel).not.toBeNull();
    expect(within(breakdownPanel as HTMLElement).getByText("Daily spending total")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("Fixed costs total")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("Holiday spend")).toBeInTheDocument();
    expect(
      within(breakdownPanel as HTMLElement).getByText("Debt payments this month"),
    ).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("£363.45")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("£1,115.99")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("£1,700.00")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("£300.00")).toBeInTheDocument();
    expect(screen.getByText("£3,700.00")).toBeInTheDocument();
    expect(screen.getByText("Outgoings")).toBeInTheDocument();
    expect(screen.getByText("£220.56")).toBeInTheDocument();
  });

  it("should show a subtle empty message when there are no holidays for the selected month", async () => {
    const fetchMock = createFetchMock({
      holidays: [],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByText("No holidays for this month")).toBeInTheDocument();
  });

  it("should include all assigned-month holiday spend in outgoings and render all holidays returned for that month", async () => {
    const fetchMock = createFetchMock({
      holidays: [
        {
          id: 1,
          name: "Japan Spring",
          destination: "Tokyo",
          isActive: true,
          assignedMonth: "2026-03",
          totalCost: "1200",
          monthlyCost: "1200",
        },
        {
          id: 2,
          name: "Finished Ski Trip",
          destination: "Geneva",
          isActive: true,
          assignedMonth: "2026-03",
          totalCost: "800",
          monthlyCost: "800",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    await screen.findByText("Japan Spring");

    expect(screen.getByText("Finished Ski Trip")).toBeInTheDocument();
    expect(screen.getByText("Outgoings")).toBeInTheDocument();
    expect(screen.getAllByText("£3,779.44")).toHaveLength(2);
    expect(screen.getByText("-£79.44")).toBeInTheDocument();
  });

  it("should show an empty-state message when no daily spending categories are available", async () => {
    const fetchMock = createFetchMock({
      budgets: [
        {
          categoryId: "category-9",
          amount: "1000",
          spent: "950",
          category: {
            id: "category-9",
            name: "Rent",
            colorCode: null,
            showOnDashboardDailySpending: false,
          },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(
      await screen.findByText("No daily spending categories found for this month."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose categories in Settings to include them here."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("should show an error message and hide the chart when the budgets request fails", async () => {
    const fetchMock = createFetchMock({
      budgets: { error: "Budget API unavailable" },
      budgetsStatus: 500,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByText("Budget API unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("should refetch month-scoped data when the previous month is selected", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect((await screen.findAllByText("Groceries, Transport")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-02", {
        cache: "no-store",
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/housing?month=2026-02", {
        cache: "no-store",
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/holidays?month=2026-02", {
        cache: "no-store",
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/income?month=2026-02", {
        cache: "no-store",
      });
    });

    expect(screen.getByText("February 2026")).toBeInTheDocument();
  });
});
