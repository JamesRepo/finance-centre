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
import { FixedCostsView } from "@/app/fixed-costs/fixed-costs-view";

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

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

type SubscriptionFixture = {
  id: number;
  name: string;
  amount: string;
  frequency: "MONTHLY" | "YEARLY";
  paymentDate: string;
  paymentMonth: string;
  description: string | null;
  createdAt: string;
  monthlyEquivalent: string;
};

type SubscriptionSummaryFixture = {
  month: string;
  subscriptions: SubscriptionFixture[];
  total: string;
  monthlyEquivalentTotal: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildSubscription(
  overrides: Partial<SubscriptionFixture> = {},
): SubscriptionFixture {
  return {
    id: 1,
    name: "Spotify",
    amount: "30",
    frequency: "MONTHLY",
    paymentDate: "2026-03-20T00:00:00.000Z",
    paymentMonth: "2026-03-01T00:00:00.000Z",
    description: null,
    createdAt: "2026-03-11T09:00:00.000Z",
    monthlyEquivalent: "30",
    ...overrides,
  };
}

function buildSubscriptionSummary(
  month: string,
  subscriptions: SubscriptionFixture[],
): SubscriptionSummaryFixture {
  const total = subscriptions.reduce(
    (sum, subscription) => sum + Number(subscription.amount),
    0,
  );
  const monthlyEquivalentTotal = subscriptions.reduce(
    (sum, subscription) => sum + Number(subscription.monthlyEquivalent),
    0,
  );

  return {
    month,
    subscriptions,
    total: total.toString(),
    monthlyEquivalentTotal: monthlyEquivalentTotal.toString(),
  };
}

function renderSubscriptionsView() {
  return render(<FixedCostsView />);
}

describe("[Component] fixed costs redirect page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to /housing when the legacy fixed-costs route is rendered", () => {
    render(<FixedCostsPage />);

    expect(mockRedirect).toHaveBeenCalledWith("/housing");
  });
});

describe("[Component] fixed costs view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should render subscription summaries when the subscriptions section loads", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(
          jsonResponse(
            buildSubscriptionSummary("2026-03", [
              buildSubscription(),
              buildSubscription({
                id: 2,
                name: "Netflix",
                amount: "120",
                frequency: "YEARLY",
                paymentDate: "2026-03-15T00:00:00.000Z",
                monthlyEquivalent: "10",
              }),
            ]),
          ),
        );
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-02", [])));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(
      within(
        screen.getByText("Subscriptions Monthly").parentElement as HTMLElement,
      ).getByText("£40.00"),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByText("Total Subscription Cost").parentElement as HTMLElement,
      ).getByText("£150.00"),
    ).toBeInTheDocument();
  });

  it("should disable autofill on the subscriptions date and month inputs when the subscriptions section renders", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/subscriptions")) {
        return Promise.resolve(
          jsonResponse(buildSubscriptionSummary("2026-03", [buildSubscription()])),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    expect(await screen.findByDisplayValue("2026-03")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("Payment date")).toHaveAttribute("autocomplete", "off");
  });

  it("should render month-scoped subscriptions with totals when the subscriptions section loads", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(
          jsonResponse(
            buildSubscriptionSummary("2026-03", [
              buildSubscription(),
              buildSubscription({
                id: 2,
                name: "Netflix",
                amount: "120",
                frequency: "YEARLY",
                paymentDate: "2026-03-15T00:00:00.000Z",
                monthlyEquivalent: "10",
              }),
            ]),
          ),
        );
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-02", [])));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    expect(await screen.findByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Day 20")).toBeInTheDocument();
    expect(screen.getByText("Day 15")).toBeInTheDocument();
    expect(
      within(
        screen.getByText("Total Cost This Month").parentElement as HTMLElement,
      ).getByText("£150.00"),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByText("Monthly Equivalent").parentElement as HTMLElement,
      ).getByText("£40.00"),
    ).toBeInTheDocument();
  });

  it("should add a subscription for the selected month when the form is submitted", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-03", [])));
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-02", [])));
      }

      if (url === "/api/subscriptions" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            buildSubscription({
              id: 9,
              name: "Gym",
              amount: "50",
              paymentDate: "2026-03-25T00:00:00.000Z",
              description: "Weights",
              monthlyEquivalent: "50",
            }),
            201,
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Gym" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Payment date"), {
      target: { value: "2026-03-25" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Weights" },
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
          month: "2026-03",
          paymentDate: "2026-03-25",
          description: "Weights",
        }),
      });
    });

    expect(await screen.findByText("Gym")).toBeInTheDocument();
    expect(screen.getByText("Weights")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue(null);
  });

  it("should update a subscription when the edit form is submitted", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(
          jsonResponse(
            buildSubscriptionSummary("2026-03", [
              buildSubscription({
                description: "Old description",
              }),
            ]),
          ),
        );
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-02", [])));
      }

      if (url === "/api/subscriptions/1" && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse(
            buildSubscription({
              name: "Spotify Family",
              amount: "45",
              paymentDate: "2026-03-22T00:00:00.000Z",
              description: "Updated plan",
              monthlyEquivalent: "45",
            }),
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Spotify Family" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "45" },
    });
    fireEvent.change(screen.getByLabelText("Payment date"), {
      target: { value: "2026-03-22" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/subscriptions/1", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Spotify Family",
          amount: 45,
          frequency: "MONTHLY",
          month: "2026-03",
          paymentDate: "2026-03-22",
          description: "Updated plan",
        }),
      });
    });

    expect(await screen.findByText("Spotify Family")).toBeInTheDocument();
    expect(screen.getByText("Updated plan")).toBeInTheDocument();
  });

  it("should delete a subscription when the delete action is used", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(
          jsonResponse(
            buildSubscriptionSummary("2026-03", [buildSubscription()]),
          ),
        );
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-02", [])));
      }

      if (url === "/api/subscriptions/1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/subscriptions/1", {
        method: "DELETE",
      });
    });

    expect(await screen.findByText("No subscriptions in March 2026")).toBeInTheDocument();
  });

  it("should copy subscriptions to the next month and navigate to that month when confirmed", async () => {
    let aprilSummaryRequestCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(
          jsonResponse(
            buildSubscriptionSummary("2026-03", [
              buildSubscription(),
              buildSubscription({
                id: 2,
                name: "Netflix",
                amount: "12",
                paymentDate: "2026-03-05T00:00:00.000Z",
                monthlyEquivalent: "12",
              }),
            ]),
          ),
        );
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-02", [])));
      }

      if (url === "/api/subscriptions?month=2026-04") {
        aprilSummaryRequestCount += 1;

        if (aprilSummaryRequestCount === 1) {
          return Promise.resolve(
            jsonResponse(buildSubscriptionSummary("2026-04", [])),
          );
        }

        return Promise.resolve(
          jsonResponse(
            buildSubscriptionSummary("2026-04", [
              buildSubscription({
                paymentDate: "2026-04-20T00:00:00.000Z",
                paymentMonth: "2026-04-01T00:00:00.000Z",
              }),
              buildSubscription({
                id: 2,
                name: "Netflix",
                amount: "12",
                paymentDate: "2026-04-05T00:00:00.000Z",
                paymentMonth: "2026-04-01T00:00:00.000Z",
                monthlyEquivalent: "12",
              }),
            ]),
          ),
        );
      }

      if (url === "/api/subscriptions/copy" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            copiedCount: 2,
            skippedCount: 0,
          }),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));

    renderSubscriptionsView();

    fireEvent.click(await screen.findByRole("button", { name: "Copy to Next Month" }));

    await waitFor(() => {
      expect(globalThis.confirm).toHaveBeenCalledWith(
        "Copy 2 subscriptions from March 2026 to April 2026? 0 already exist and will be skipped.",
      );
      expect(fetchMock).toHaveBeenCalledWith("/api/subscriptions/copy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceMonth: "2026-03",
          targetMonth: "2026-04",
        }),
      });
    });

    expect(await screen.findByDisplayValue("2026-04")).toBeInTheDocument();
    expect(await screen.findByText("April 2026")).toBeInTheDocument();
  });

  it("should show the subscriptions empty state with previous-month copy affordance when the selected month is empty", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-03", [])));
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(
          jsonResponse(
            buildSubscriptionSummary("2026-02", [buildSubscription()]),
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    expect(await screen.findByText("No subscriptions in March 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy from February 2026" }),
    ).toBeInTheDocument();
  });

  it("should show validation errors when the subscription form is submitted empty", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/subscriptions?month=2026-03") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-03", [])));
      }

      if (url === "/api/subscriptions?month=2026-02") {
        return Promise.resolve(jsonResponse(buildSubscriptionSummary("2026-02", [])));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSubscriptionsView();

    fireEvent.change(await screen.findByLabelText("Payment date"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add subscription" }));

    expect(await screen.findByText("Enter a subscription name")).toBeInTheDocument();
    expect(screen.getByText("Enter an amount greater than 0")).toBeInTheDocument();
    expect(screen.getByText("Enter a payment date")).toBeInTheDocument();
  });
});
