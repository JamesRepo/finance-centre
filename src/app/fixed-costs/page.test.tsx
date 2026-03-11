// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FixedCostsPage from "@/app/fixed-costs/page";

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

type SubscriptionFixture = {
  id: number;
  name: string;
  amount: string;
  frequency: "MONTHLY" | "YEARLY";
  nextPaymentDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  monthlyEquivalent: string;
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

function buildSubscription(
  overrides: Partial<SubscriptionFixture> = {},
): SubscriptionFixture {
  return {
    id: 1,
    name: "Spotify",
    amount: "30",
    frequency: "MONTHLY",
    nextPaymentDate: "2026-03-20T00:00:00.000Z",
    description: null,
    isActive: true,
    createdAt: "2026-03-11T09:00:00.000Z",
    monthlyEquivalent: "30",
    ...overrides,
  };
}

describe("[Component] fixed costs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should render combined fixed-cost summaries when housing and subscriptions load", async () => {
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
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions") {
        return Promise.resolve(
          jsonResponse([
            buildSubscription(),
            buildSubscription({
              id: 2,
              name: "Prime",
              amount: "120",
              frequency: "YEARLY",
              monthlyEquivalent: "10",
            }),
            buildSubscription({
              id: 3,
              name: "Archived App",
              amount: "25",
              isActive: false,
              monthlyEquivalent: "25",
            }),
          ]),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FixedCostsPage />);

    expect(await screen.findByText("Housing expenses")).toBeInTheDocument();
    expect(
      within(screen.getByText("Housing Monthly").parentElement as HTMLElement).getByText(
        "£1,210.00",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByText("Subscriptions Monthly").parentElement as HTMLElement,
      ).getByText("£40.00"),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByText("Total Fixed Costs").parentElement as HTMLElement,
      ).getByText("£1,250.00"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/housing?month=2026-03", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/housing?month=2026-02", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions", {
      cache: "no-store",
    });
  });

  it("should save a housing amount on blur when an amount is edited inline", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions") {
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

    render(<FixedCostsPage />);

    const amountButton = await screen.findByRole("button", { name: "£1,200.00" });

    fireEvent.click(amountButton);

    const amountInput = screen.getByDisplayValue("1200.00");
    fireEvent.change(amountInput, { target: { value: "1300" } });
    fireEvent.blur(amountInput);

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

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "£1,300.00" })).toBeInTheDocument();
  });

  it("should show an error and avoid saving when a housing amount is cleared", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(jsonResponse([buildHousingExpense()]));
      }

      if (url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions") {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FixedCostsPage />);

    const amountButton = await screen.findByRole("button", { name: "£1,200.00" });

    fireEvent.click(amountButton);

    const amountInput = screen.getByDisplayValue("1200.00");
    fireEvent.change(amountInput, { target: { value: "" } });
    fireEvent.blur(amountInput);

    expect(await screen.findByText("Enter an amount greater than 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "£1,200.00" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

      if (url === "/api/subscriptions") {
        return Promise.resolve(jsonResponse([]));
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

    render(<FixedCostsPage />);

    const copyButton = await screen.findByRole("button", {
      name: "Copy 1 unchanged from February 2026",
    });

    fireEvent.click(copyButton);

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

    expect(await screen.findByRole("button", { name: "£45.00" })).toBeInTheDocument();
  });

  it("should show a housing error message when the current-month request fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03") {
        return Promise.resolve(
          jsonResponse({ error: "Housing service unavailable" }, 500),
        );
      }

      if (url === "/api/subscriptions") {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FixedCostsPage />);

    expect(
      await screen.findByText("Housing service unavailable"),
    ).toBeInTheDocument();
  });

  it("should render active and inactive subscriptions separately when the subscriptions tab is opened", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03" || url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions") {
        return Promise.resolve(
          jsonResponse([
            buildSubscription(),
            buildSubscription({
              id: 2,
              name: "Netflix",
              amount: "120",
              frequency: "YEARLY",
              monthlyEquivalent: "10",
            }),
            buildSubscription({
              id: 3,
              name: "Old Service",
              amount: "15",
              isActive: false,
              monthlyEquivalent: "15",
            }),
          ]),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FixedCostsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Subscriptions" }));

    expect(await screen.findByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Inactive subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Old Service")).toBeInTheDocument();
    expect(
      within(
        screen
          .getByText("Total monthly subscription cost")
          .parentElement as HTMLElement,
      ).getByText("£40.00"),
    ).toBeInTheDocument();
  });

  it("should add a subscription and render it in the active list when the form is submitted", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03" || url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions" && !init) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            buildSubscription({
              id: 9,
              name: "Gym",
              amount: "50",
              nextPaymentDate: "2026-03-25",
              monthlyEquivalent: "50",
            }),
            201,
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FixedCostsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Subscriptions" }));

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Gym" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Next payment date"), {
      target: { value: "2026-03-25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add subscription" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/subscriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Gym",
          amount: 50,
          frequency: "MONTHLY",
          nextPaymentDate: "2026-03-25",
        }),
      });
    });

    expect(await screen.findByText("Gym")).toBeInTheDocument();
  });

  it("should toggle a subscription to inactive when the card action is used", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03" || url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions") {
        return Promise.resolve(jsonResponse([buildSubscription()]));
      }

      if (url === "/api/subscriptions/1" && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse(
            buildSubscription({
              isActive: false,
            }),
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FixedCostsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Subscriptions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark inactive" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/subscriptions/1", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          isActive: false,
        }),
      });
    });

    expect(await screen.findByText("Inactive subscriptions")).toBeInTheDocument();
    const inactiveSection = screen.getByText("Inactive subscriptions").closest("div");
    expect(within(inactiveSection?.parentElement as HTMLElement).getByText("Spotify")).toBeInTheDocument();
  });

  it("should show validation errors when the subscription form is submitted empty", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/housing?month=2026-03" || url === "/api/housing?month=2026-02") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/subscriptions") {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FixedCostsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Subscriptions" }));
    fireEvent.change(screen.getByLabelText("Next payment date"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add subscription" }));

    expect(await screen.findByText("Enter a subscription name")).toBeInTheDocument();
    expect(
      screen.getByText("Invalid input: expected number, received NaN"),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a payment date")).toBeInTheDocument();
  });
});
