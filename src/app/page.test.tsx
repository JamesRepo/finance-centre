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

const debtsResponse = [
  {
    id: 1,
    name: "Credit Card",
    originalBalance: "5000",
    isActive: true,
    currentBalance: "3500",
    principalPaid: "1500",
  },
  {
    id: 2,
    name: "Student Loan",
    originalBalance: "20000",
    isActive: true,
    currentBalance: "12000",
    principalPaid: "8000",
  },
  {
    id: 3,
    name: "Old Car Loan",
    originalBalance: "10000",
    isActive: false,
    currentBalance: "0",
    principalPaid: "10000",
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
    name: "Holiday",
    targetAmount: "2000",
    currentAmount: "800",
    progress: "40",
  },
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
  budgetsStatus = 200,
  debtsStatus = 200,
  savingsStatus = 200,
}: {
  budgets?: unknown;
  debts?: unknown;
  savings?: unknown;
  budgetsStatus?: number;
  debtsStatus?: number;
  savingsStatus?: number;
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
    return Promise.resolve(jsonResponse({ error: "Not found" }, 404));
  });
}

describe("[Component] dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should fetch the current month and render summary stats when the page loads", async () => {
    const fetchMock = createFetchMock();
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
    const fetchMock = createFetchMock();
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
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    await screen.findByText("Groceries, Transport");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-02", {
        cache: "no-store",
      });
    });

    expect(screen.getByText("February 2026")).toBeInTheDocument();
  });

  it("should show an error message when the dashboard request fails", async () => {
    const fetchMock = createFetchMock({
      budgets: { error: "Budget API unavailable" },
      budgetsStatus: 500,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(
      await screen.findByText("Budget API unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  describe("Debt Payoff section", () => {
    it("should show loading state for debts initially", () => {
      const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(screen.getByText("Loading debts...")).toBeInTheDocument();
    });

    it("should display active debts with progress bars and totals", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Credit Card")).toBeInTheDocument();
      expect(screen.getByText("Student Loan")).toBeInTheDocument();
      // Inactive debts should be filtered out
      expect(screen.queryByText("Old Car Loan")).not.toBeInTheDocument();

      // Check balance labels
      expect(screen.getByText("£3,500.00 left")).toBeInTheDocument();
      expect(screen.getByText("£12,000.00 left")).toBeInTheDocument();

      // Check percentage labels
      expect(screen.getByText("30% paid off")).toBeInTheDocument(); // 1500/5000
      expect(screen.getByText("40% paid off")).toBeInTheDocument(); // 8000/20000

      // Check total remaining: 3500 + 12000 = 15500
      expect(screen.getByText("£15,500.00")).toBeInTheDocument();
    });

    it("should show empty state when there are no active debts", async () => {
      const fetchMock = createFetchMock({
        debts: [
          {
            id: 1,
            name: "Old Loan",
            originalBalance: "5000",
            isActive: false,
            currentBalance: "0",
            principalPaid: "5000",
          },
        ],
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("No active debts.")).toBeInTheDocument();
    });

    it("should show empty state when debts response is an empty array", async () => {
      const fetchMock = createFetchMock({ debts: [] });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("No active debts.")).toBeInTheDocument();
    });

    it("should render the View all link to /debts", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await screen.findByText("Debt Payoff");

      const viewAllLinks = screen.getAllByRole("link", { name: "View all" });
      const debtViewAll = viewAllLinks.find((link) => link.getAttribute("href") === "/debts");
      expect(debtViewAll).toBeInTheDocument();
    });

    it("should cap debt progress at 100% when principal paid exceeds original balance", async () => {
      const fetchMock = createFetchMock({
        debts: [
          {
            id: 1,
            name: "Overpaid Debt",
            originalBalance: "1000",
            isActive: true,
            currentBalance: "0",
            principalPaid: "1200",
          },
        ],
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("100% paid off")).toBeInTheDocument();
    });

    it("should handle zero original balance without NaN", async () => {
      const fetchMock = createFetchMock({
        debts: [
          {
            id: 1,
            name: "Zero Debt",
            originalBalance: "0",
            isActive: true,
            currentBalance: "0",
            principalPaid: "0",
          },
        ],
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("0% paid off")).toBeInTheDocument();
    });

    it("should silently handle a failed debts API response", async () => {
      const fetchMock = createFetchMock({ debtsStatus: 500, debts: { error: "fail" } });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      // Budgets should still load fine
      expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
      // Debts should show empty state (not an error)
      expect(screen.getByText("No active debts.")).toBeInTheDocument();
    });

    it("should silently handle a network error for debts", async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url === "/api/debts") {
          return Promise.reject(new Error("Network error"));
        }
        if (url.startsWith("/api/budgets")) {
          return Promise.resolve(jsonResponse(budgetsResponse));
        }
        if (url === "/api/savings") {
          return Promise.resolve(jsonResponse(savingsResponse));
        }
        return Promise.resolve(jsonResponse({}, 404));
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
      expect(screen.getByText("No active debts.")).toBeInTheDocument();
    });
  });

  describe("Savings Goals section", () => {
    it("should show loading state for savings initially", () => {
      const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(screen.getByText("Loading savings...")).toBeInTheDocument();
    });

    it("should display savings goals with progress and totals", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Emergency Fund")).toBeInTheDocument();
      expect(screen.getByText("Holiday")).toBeInTheDocument();

      // Check current/target labels
      expect(screen.getByText("£4,500.00 / £10,000.00")).toBeInTheDocument();
      expect(screen.getByText("£800.00 / £2,000.00")).toBeInTheDocument();

      // Check percentage labels
      expect(screen.getByText("45%")).toBeInTheDocument();
      expect(screen.getByText("40%")).toBeInTheDocument();

      // Check total saved: 4500 + 800 = 5300
      expect(screen.getByText("£5,300.00")).toBeInTheDocument();
    });

    it("should show empty state when there are no savings goals", async () => {
      const fetchMock = createFetchMock({ savings: [] });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("No savings goals yet.")).toBeInTheDocument();
    });

    it("should render the View all link to /savings", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await screen.findByText("Savings Goals");

      const viewAllLinks = screen.getAllByRole("link", { name: "View all" });
      const savingsViewAll = viewAllLinks.find((link) => link.getAttribute("href") === "/savings");
      expect(savingsViewAll).toBeInTheDocument();
    });

    it("should cap savings progress at 100% when over-saved", async () => {
      const fetchMock = createFetchMock({
        savings: [
          {
            id: 1,
            name: "Over-saved Goal",
            targetAmount: "1000",
            currentAmount: "1500",
            progress: "150",
          },
        ],
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      // Progress text should be capped at 100%
      expect(await screen.findByText("100%")).toBeInTheDocument();
    });

    it("should silently handle a failed savings API response", async () => {
      const fetchMock = createFetchMock({ savingsStatus: 500, savings: { error: "fail" } });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
      expect(screen.getByText("No savings goals yet.")).toBeInTheDocument();
    });

    it("should silently handle a network error for savings", async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url === "/api/savings") {
          return Promise.reject(new Error("Network error"));
        }
        if (url.startsWith("/api/budgets")) {
          return Promise.resolve(jsonResponse(budgetsResponse));
        }
        if (url === "/api/debts") {
          return Promise.resolve(jsonResponse(debtsResponse));
        }
        return Promise.resolve(jsonResponse({}, 404));
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
      expect(screen.getByText("No savings goals yet.")).toBeInTheDocument();
    });
  });

  describe("Section headings and layout", () => {
    it("should render Debt Payoff and Savings Goals headings", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Debt Payoff")).toBeInTheDocument();
      expect(screen.getByText("Savings Goals")).toBeInTheDocument();
    });

    it("should fetch debts and savings endpoints on mount", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await screen.findByText("Groceries, Transport");

      expect(fetchMock).toHaveBeenCalledWith("/api/debts", { cache: "no-store" });
      expect(fetchMock).toHaveBeenCalledWith("/api/savings", { cache: "no-store" });
    });
  });
});
