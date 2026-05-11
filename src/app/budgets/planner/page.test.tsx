// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BudgetPlannerPage from "@/app/budgets/planner/page";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const planList = [
  {
    id: 1,
    name: "Annual plan",
    startMonth: "2026-06",
    endMonth: "2027-05",
    itemCount: 7,
  },
];

const planDetail = {
  id: 1,
  name: "Annual plan",
  startMonth: "2026-06",
  endMonth: "2027-05",
  items: [
    {
      id: 10,
      stream: "CATEGORY",
      streamLabel: "Spending",
      label: "Groceries",
      amount: "2000",
      cadence: "MONTHLY",
      colorCode: "#22c55e",
      sortOrder: 1,
      isCustom: false,
      enabled: true,
      monthlyEquivalent: 2000,
      periodTotal: 24000,
    },
  ],
  monthlyCashflow: [
    {
      month: "2026-06",
      income: 0,
      spending: 2000,
      debtPayments: 0,
      savings: 0,
      outgoings: 2000,
      netPosition: -2000,
    },
  ],
  summary: {
    income: 0,
    spending: 24000,
    debtPayments: 0,
    savings: 0,
    outgoings: 24000,
    netPosition: -24000,
    averageMonthlyNet: -2000,
  },
};

describe("[Component] BudgetPlannerPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should create a plan with the current form values when there are no saved plans", async () => {
    const user = userEvent.setup();
    const createdPlan = {
      ...planDetail,
      id: 2,
      name: "Long-term budget plan",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdPlan, 201))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 2,
            name: "Long-term budget plan",
            startMonth: createdPlan.startMonth,
            endMonth: createdPlan.endMonth,
            itemCount: createdPlan.items.length,
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(createdPlan));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    await screen.findByText("Create a plan to start adjusting long-term budgets.");
    fireEvent.change(screen.getByLabelText("Plan name"), {
      target: { value: "Scenario A" },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-06" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2027-05" },
    });

    await user.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budget-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Scenario A",
          startMonth: "2026-06",
          endMonth: "2027-05",
        }),
      });
    });
    expect(await screen.findByText("Groceries")).toBeInTheDocument();
  });

  it("should save plan details when an existing plan form is edited", async () => {
    const user = userEvent.setup();
    const updatedPlan = {
      ...planDetail,
      name: "Updated annual plan",
      endMonth: "2027-06",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(planList))
      .mockResolvedValueOnce(jsonResponse(planDetail))
      .mockResolvedValueOnce(jsonResponse(updatedPlan))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            ...planList[0],
            name: "Updated annual plan",
            endMonth: "2027-06",
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(updatedPlan));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    await screen.findByLabelText("Groceries amount");
    fireEvent.change(screen.getByLabelText("Plan name"), {
      target: { value: "Updated annual plan" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2027-06" },
    });

    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budget-plans/1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Updated annual plan",
          startMonth: "2026-06",
          endMonth: "2027-06",
        }),
      });
    });
  });

  it("should show an API error when loading plans fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Planner unavailable" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    expect(await screen.findByText("Planner unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Create a plan to start adjusting long-term budgets."),
    ).toBeInTheDocument();
  });

  it("should keep the slider max stable while the slider draft changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(planList))
      .mockResolvedValueOnce(jsonResponse(planDetail));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    const slider = await screen.findByLabelText("Groceries amount");

    expect(slider).toHaveAttribute("max", "3000");

    fireEvent.change(slider, { target: { value: "2500" } });

    expect(slider).toHaveAttribute("max", "3000");
  });

  it("should save slider changes after the debounce", async () => {
    const updatedPlan = {
      ...planDetail,
      items: [
        {
          ...planDetail.items[0],
          amount: "2500",
          monthlyEquivalent: 2500,
          periodTotal: 30000,
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(planList))
      .mockResolvedValueOnce(jsonResponse(planDetail))
      .mockResolvedValueOnce(jsonResponse(updatedPlan));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    const slider = await screen.findByLabelText("Groceries amount");

    fireEvent.change(slider, { target: { value: "2500" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budget-plans/1/items/10", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: "2500.00" }),
      });
    });
  });

  it("should show transaction category rows under the planner", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(planList))
      .mockResolvedValueOnce(jsonResponse(planDetail));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(screen.getByLabelText("Groceries amount")).toBeInTheDocument();
  });

  it("should disable an active planner item when the active checkbox is cleared", async () => {
    const user = userEvent.setup();
    const updatedPlan = {
      ...planDetail,
      items: [
        {
          ...planDetail.items[0],
          enabled: false,
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(planList))
      .mockResolvedValueOnce(jsonResponse(planDetail))
      .mockResolvedValueOnce(jsonResponse(updatedPlan));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    const activeCheckbox = await screen.findByRole("checkbox", { name: "Active" });
    await user.click(activeCheckbox);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budget-plans/1/items/10", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
    });
  });

  it("should delete the selected plan and return to the empty state", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(planList))
      .mockResolvedValueOnce(jsonResponse(planDetail))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<BudgetPlannerPage />);

    await screen.findByLabelText("Groceries amount");
    const deleteButtons = screen.getAllByRole("button", { name: "Delete plan" });
    expect(deleteButtons).toHaveLength(2);

    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/budget-plans/1", {
        method: "DELETE",
      });
    });
    expect(
      await screen.findByText("Create a plan to start adjusting long-term budgets."),
    ).toBeInTheDocument();
  });
});
