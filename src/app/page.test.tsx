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

const housingResponse = [
  { id: 1, expenseType: "RENT", amount: "950", frequency: "MONTHLY" },
  { id: 2, expenseType: "ENERGY", amount: "120", frequency: "MONTHLY" },
];

const subscriptionsResponse = [
  { id: 1, name: "Netflix", amount: "15.99", frequency: "MONTHLY", monthlyEquivalent: "15.99", isActive: true },
  { id: 2, name: "Gym", amount: "360", frequency: "YEARLY", monthlyEquivalent: "30", isActive: true },
  { id: 3, name: "Old Service", amount: "10", frequency: "MONTHLY", monthlyEquivalent: "10", isActive: false },
];

const incomeResponse = [
  { id: 1, netAmount: "3200", isRecurring: true, recurrenceFrequency: "MONTHLY", isActive: true },
  { id: 2, netAmount: "500", isRecurring: false, recurrenceFrequency: null, isActive: true },
  { id: 3, netAmount: "1000", isRecurring: true, recurrenceFrequency: "MONTHLY", isActive: false },
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
  income = incomeResponse,
  budgetsStatus = 200,
  debtsStatus = 200,
  savingsStatus = 200,
  housingStatus = 200,
  subscriptionsStatus = 200,
  incomeStatus = 200,
}: {
  budgets?: unknown;
  debts?: unknown;
  savings?: unknown;
  housing?: unknown;
  subscriptions?: unknown;
  income?: unknown;
  budgetsStatus?: number;
  debtsStatus?: number;
  savingsStatus?: number;
  housingStatus?: number;
  subscriptionsStatus?: number;
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
    if (url === "/api/subscriptions") {
      return Promise.resolve(jsonResponse(subscriptions, subscriptionsStatus));
    }
    if (url.startsWith("/api/income")) {
      return Promise.resolve(jsonResponse(income, incomeStatus));
    }
    return Promise.resolve(jsonResponse({ error: "Not found" }, 404));
  });
}

/** Helper to find a summary card by its label text, then return the value element. */
function getCardValue(labelText: string) {
  const label = screen.getByText(labelText);
  const article = label.closest("article");
  if (!article) throw new Error(`No article parent found for label "${labelText}"`);
  return within(article).getAllByText(/./)[1]; // second <p> in the article is the value
}

describe("[Component] dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should fetch the current month and render budget chart when the page loads", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-03", {
      cache: "no-store",
    });
    expect(screen.getByText("March 2026")).toBeInTheDocument();
  });

  it("should render budget summary cards with correct values", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);
    await screen.findByText("Groceries, Transport");

    // Total budgeted: 500 + 200 = 700
    const budgetedCard = screen.getByText("Total budgeted").closest("article")!;
    expect(within(budgetedCard).getByText("£700.00")).toBeInTheDocument();

    // Total spent: 123.45 + 240 = 363.45
    const spentCard = screen.getByText("Total spent").closest("article")!;
    expect(within(spentCard).getByText("£363.45")).toBeInTheDocument();

    // Remaining: 700 - 363.45 = 336.55
    const remainingCard = screen.getByText("Remaining").closest("article")!;
    expect(within(remainingCard).getByText("£336.55")).toBeInTheDocument();
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

  it("should set budgetBarAmount to zero for categories with no budget and no spending", async () => {
    const fetchMock = createFetchMock({
      budgets: [
        {
          categoryId: "category-1",
          amount: "500",
          spent: "123.45",
          category: { id: "category-1", name: "Groceries", colorCode: "#22c55e" },
        },
        {
          categoryId: "category-2",
          amount: "0",
          spent: "0",
          category: { id: "category-2", name: "Transport", colorCode: "#3b82f6" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    const chartData = await screen.findByTestId("bar-chart-data");
    const parsedData = JSON.parse(chartData.textContent ?? "[]") as Array<{
      categoryId: string;
      budgetBarAmount: number;
      spentAmount: number;
      spentFillRatio: number;
    }>;

    const transport = parsedData.find((entry) => entry.categoryId === "category-2");
    expect(transport).toMatchObject({
      budgetBarAmount: 0,
      spentAmount: 0,
      spentFillRatio: 0,
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

  describe("Monthly overview cards", () => {
    it("should display the monthly income (net) from active income entries", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      // Active income: 3200 + 500 = 3700 (id:3 is inactive)
      await waitFor(() => {
        const card = screen.getByText("Monthly income (net)").closest("article")!;
        expect(within(card).getByText("£3,700.00")).toBeInTheDocument();
      });
    });

    it("should display the budgeted spending in the overview card", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);
      await screen.findByText("Groceries, Transport");

      const card = screen.getByText("Budgeted spending").closest("article")!;
      expect(within(card).getByText("£700.00")).toBeInTheDocument();
    });

    it("should display the total fixed costs in the overview card", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      // Housing: 950 + 120 = 1070, active subscriptions: 15.99 + 30 = 45.99
      // Total: 1070 + 45.99 = 1115.99
      await waitFor(() => {
        const card = screen.getByText("Fixed costs").closest("article")!;
        expect(within(card).getByText("£1,115.99")).toBeInTheDocument();
      });
    });

    it("should display the net position (income - budgets - fixed costs)", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      // Income: 3700, Budgets: 700, Fixed: 1115.99
      // Net: 3700 - 700 - 1115.99 = 1884.01
      await waitFor(() => {
        const card = screen.getByText("Net position").closest("article")!;
        expect(within(card).getByText("£1,884.01")).toBeInTheDocument();
      });
    });

    it("should show net position in red when negative", async () => {
      const fetchMock = createFetchMock({
        income: [{ id: 1, netAmount: "100", isRecurring: false, recurrenceFrequency: null, isActive: true }],
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      // Income: 100, Budgets: 700, Fixed: 1115.99 => net = -1715.99
      await waitFor(() => {
        const card = screen.getByText("Net position").closest("article")!;
        const value = within(card).getByText("-£1,715.99");
        expect(value.className).toContain("text-red-600");
      });
    });

    it("should show net position in green when positive", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await waitFor(() => {
        const card = screen.getByText("Net position").closest("article")!;
        const value = within(card).getByText("£1,884.01");
        expect(value.className).toContain("text-green-600");
      });
    });

    it("should show £0.00 for income when no income entries exist", async () => {
      const fetchMock = createFetchMock({ income: [] });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await waitFor(() => {
        const card = screen.getByText("Monthly income (net)").closest("article")!;
        expect(within(card).getByText("£0.00")).toBeInTheDocument();
      });
    });

    it("should show loading states while data is being fetched", () => {
      const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Fixed costs breakdown section", () => {
    it("should display the Fixed Costs heading and Manage link", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);
      await screen.findByText("Fixed Costs");

      const manageLink = screen.getByRole("link", { name: "Manage" });
      expect(manageLink).toHaveAttribute("href", "/fixed-costs");
    });

    it("should show housing, subscriptions, and total in the breakdown", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText("Housing")).toBeInTheDocument();
        expect(screen.getByText("Subscriptions")).toBeInTheDocument();
        expect(screen.getByText("Total monthly")).toBeInTheDocument();
      });

      // Housing: 950 + 120 = 1070
      const housingLabel = screen.getByText("Housing");
      const housingCard = housingLabel.closest("div.rounded-2xl")!;
      expect(within(housingCard).getByText("£1,070.00")).toBeInTheDocument();

      // Active subscriptions: 15.99 + 30 = 45.99
      const subsLabel = screen.getByText("Subscriptions");
      const subsCard = subsLabel.closest("div.rounded-2xl")!;
      expect(within(subsCard).getByText("£45.99")).toBeInTheDocument();

      // Total: 1070 + 45.99 = 1115.99
      const totalLabel = screen.getByText("Total monthly");
      const totalCard = totalLabel.closest("div.rounded-2xl")!;
      expect(within(totalCard).getByText("£1,115.99")).toBeInTheDocument();
    });

    it("should exclude inactive subscriptions from the total", async () => {
      const fetchMock = createFetchMock({
        subscriptions: [
          { id: 1, name: "Active Sub", amount: "20", frequency: "MONTHLY", monthlyEquivalent: "20", isActive: true },
          { id: 2, name: "Cancelled", amount: "50", frequency: "MONTHLY", monthlyEquivalent: "50", isActive: false },
        ],
        housing: [],
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await waitFor(() => {
        const totalLabel = screen.getByText("Total monthly");
        const totalCard = totalLabel.closest("div.rounded-2xl")!;
        expect(within(totalCard).getByText("£20.00")).toBeInTheDocument();
      });
    });

    it("should show loading state for fixed costs initially", () => {
      const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(screen.getByText("Loading fixed costs...")).toBeInTheDocument();
    });

    it("should show zero when there are no housing expenses or subscriptions", async () => {
      const fetchMock = createFetchMock({
        housing: [],
        subscriptions: [],
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await waitFor(() => {
        const totalLabel = screen.getByText("Total monthly");
        const totalCard = totalLabel.closest("div.rounded-2xl")!;
        expect(within(totalCard).getByText("£0.00")).toBeInTheDocument();
      });
    });

    it("should refetch housing expenses when the month changes", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);
      await screen.findByText("Groceries, Transport");

      fireEvent.click(screen.getByRole("button", { name: "Previous" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/housing?month=2026-02", {
          cache: "no-store",
        });
      });
    });

    it("should refetch income when the month changes", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);
      await screen.findByText("Groceries, Transport");

      fireEvent.click(screen.getByRole("button", { name: "Previous" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/income?month=2026-02", {
          cache: "no-store",
        });
      });
    });

    it("should silently handle a failed housing API response", async () => {
      const fetchMock = createFetchMock({ housingStatus: 500, housing: { error: "fail" } });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      // Budget chart should still load
      expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
      // Fixed costs should show with zero housing
      await waitFor(() => {
        expect(screen.getByText("Housing")).toBeInTheDocument();
      });
    });

    it("should silently handle a failed subscriptions API response", async () => {
      const fetchMock = createFetchMock({ subscriptionsStatus: 500, subscriptions: { error: "fail" } });
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Groceries, Transport")).toBeInTheDocument();
    });
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
        if (url.startsWith("/api/housing")) {
          return Promise.resolve(jsonResponse(housingResponse));
        }
        if (url === "/api/subscriptions") {
          return Promise.resolve(jsonResponse(subscriptionsResponse));
        }
        if (url.startsWith("/api/income")) {
          return Promise.resolve(jsonResponse(incomeResponse));
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
        if (url.startsWith("/api/housing")) {
          return Promise.resolve(jsonResponse(housingResponse));
        }
        if (url === "/api/subscriptions") {
          return Promise.resolve(jsonResponse(subscriptionsResponse));
        }
        if (url.startsWith("/api/income")) {
          return Promise.resolve(jsonResponse(incomeResponse));
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
    it("should render all section headings", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      expect(await screen.findByText("Debt Payoff")).toBeInTheDocument();
      expect(screen.getByText("Savings Goals")).toBeInTheDocument();
      expect(screen.getByText("Fixed Costs")).toBeInTheDocument();
      expect(screen.getByText("Monthly dashboard")).toBeInTheDocument();
    });

    it("should fetch all endpoints on mount", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);

      await screen.findByText("Groceries, Transport");

      expect(fetchMock).toHaveBeenCalledWith("/api/budgets?month=2026-03", { cache: "no-store" });
      expect(fetchMock).toHaveBeenCalledWith("/api/debts", { cache: "no-store" });
      expect(fetchMock).toHaveBeenCalledWith("/api/savings", { cache: "no-store" });
      expect(fetchMock).toHaveBeenCalledWith("/api/housing?month=2026-03", { cache: "no-store" });
      expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions", { cache: "no-store" });
      expect(fetchMock).toHaveBeenCalledWith("/api/income?month=2026-03", { cache: "no-store" });
    });

    it("should render the Edit budgets and View transactions links", async () => {
      const fetchMock = createFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      render(<Home />);
      await screen.findByText("Groceries, Transport");

      expect(screen.getByRole("link", { name: "Edit budgets" })).toHaveAttribute("href", "/budgets");
      expect(screen.getByRole("link", { name: "View transactions" })).toHaveAttribute("href", "/transactions");
    });
  });
});
