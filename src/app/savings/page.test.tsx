// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { format } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SavingsPage from "@/app/savings/page";

const today = format(new Date(), "yyyy-MM-dd");

type GoalFixture = {
  id: number;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | null;
  createdAt: string;
  savingsContributions: Array<{
    id: number;
    goalId: number;
    amount: string;
    contributionDate: string;
    note: string | null;
    createdAt: string;
  }>;
  currentAmount: string;
  progress: string;
};

function buildGoal(overrides: Partial<GoalFixture> = {}): GoalFixture {
  return {
    id: 1,
    name: "Emergency Fund",
    targetAmount: "5000",
    targetDate: null,
    priority: "HIGH",
    createdAt: "2026-03-01T00:00:00.000Z",
    savingsContributions: [],
    currentAmount: "1250",
    progress: "25",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("[Component] savings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should fetch goals and render the summary cards when the page loads", async () => {
    const goals = [
      buildGoal(),
      buildGoal({
        id: 2,
        name: "Holiday",
        targetAmount: "3000",
        priority: "LOW",
        currentAmount: "750",
        progress: "25",
      }),
    ];

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(goals));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    expect(await screen.findByText("Emergency Fund")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/savings", {
      cache: "no-store",
    });

    // Total saved: 1250 + 750 = 2000
    expect(screen.getByText("£2,000.00")).toBeInTheDocument();
    // Active goals count
    expect(screen.getByText("2")).toBeInTheDocument();
    // Overall progress: 2000 / 8000 = 25% — also appears on each goal card
    expect(screen.getAllByText("25%").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Holiday")).toBeInTheDocument();
  });

  it("should display the empty state when no goals exist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    expect(
      await screen.findByText("No savings goals have been added yet."),
    ).toBeInTheDocument();
  });

  it("should show an error message when the initial goals request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: "Savings API unavailable" }, 500),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    expect(
      await screen.findByText("Savings API unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Emergency Fund")).not.toBeInTheDocument();
  });

  it("should show the loading state before goals are fetched", () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    expect(screen.getByText("Loading savings goals...")).toBeInTheDocument();
  });

  it("should render the priority badge with the correct label for each priority level", async () => {
    const goals = [
      buildGoal({ id: 1, name: "Fund A", priority: "HIGH" }),
      buildGoal({ id: 2, name: "Fund B", priority: "MEDIUM" }),
      buildGoal({ id: 3, name: "Fund C", priority: "LOW" }),
    ];

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(goals));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Fund A");

    const articles = screen.getAllByRole("article");

    expect(within(articles[0]).getByText("HIGH")).toBeInTheDocument();
    expect(within(articles[1]).getByText("MEDIUM")).toBeInTheDocument();
    expect(within(articles[2]).getByText("LOW")).toBeInTheDocument();
  });

  it("should not render a priority badge when the goal has no priority", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([buildGoal({ priority: null })]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    expect(screen.queryByText("HIGH")).not.toBeInTheDocument();
    expect(screen.queryByText("MEDIUM")).not.toBeInTheDocument();
    expect(screen.queryByText("LOW")).not.toBeInTheDocument();
  });

  it("should display target date and months remaining when a target date is set in the future", async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);
    const futureDateIso = futureDate.toISOString();

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([buildGoal({ targetDate: futureDateIso })]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    expect(screen.getByText("Target date:")).toBeInTheDocument();
    expect(screen.getByText("Months remaining:")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("should display 'Past due' when the target date is in the past", async () => {
    const pastDate = "2024-01-01T00:00:00.000Z";

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([buildGoal({ targetDate: pastDate })]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    expect(screen.getByText("Past due")).toBeInTheDocument();
  });

  it("should not display target date or months remaining when no target date is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([buildGoal({ targetDate: null })]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    expect(screen.queryByText("Target date:")).not.toBeInTheDocument();
    expect(screen.queryByText("Months remaining:")).not.toBeInTheDocument();
  });

  it("should display the progress bar and remaining amount correctly", async () => {
    const goal = buildGoal({
      targetAmount: "10000",
      currentAmount: "2500",
      progress: "25",
    });

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([goal]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    // Progress text
    expect(
      screen.getByText((_, element) =>
        element?.textContent === "Saved £2,500.00 of £10,000.00",
      ),
    ).toBeInTheDocument();

    // Remaining
    expect(screen.getByText("£7,500.00")).toBeInTheDocument();
  });

  it("should clamp remaining to zero when contributions exceed the target", async () => {
    const goal = buildGoal({
      targetAmount: "1000",
      currentAmount: "1200",
      progress: "120",
    });

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([goal]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    // Remaining should be £0.00 (clamped)
    expect(screen.getByText("£0.00")).toBeInTheDocument();
  });

  it("should show only the last 5 contributions sorted by date descending", async () => {
    const contributions = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      goalId: 1,
      amount: String((index + 1) * 100),
      contributionDate: `2026-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      note: `Note ${index + 1}`,
      createdAt: `2026-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    const goal = buildGoal({ savingsContributions: contributions });

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([goal]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    // Should show notes 3–7 (most recent 5)
    expect(screen.getByText("Note 7")).toBeInTheDocument();
    expect(screen.getByText("Note 6")).toBeInTheDocument();
    expect(screen.getByText("Note 5")).toBeInTheDocument();
    expect(screen.getByText("Note 4")).toBeInTheDocument();
    expect(screen.getByText("Note 3")).toBeInTheDocument();

    // Should NOT show notes 1–2 (oldest, trimmed)
    expect(screen.queryByText("Note 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Note 2")).not.toBeInTheDocument();
  });

  it("should display 'No note' for contributions without a note", async () => {
    const goal = buildGoal({
      savingsContributions: [
        {
          id: 10,
          goalId: 1,
          amount: "200",
          contributionDate: "2026-03-10T00:00:00.000Z",
          note: null,
          createdAt: "2026-03-10T00:00:00.000Z",
        },
      ],
    });

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([goal]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    expect(screen.getByText("No note")).toBeInTheDocument();
  });

  it("should show the empty contributions state when a goal has no contributions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([buildGoal({ savingsContributions: [] })]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    expect(
      screen.getByText("No contributions recorded yet."),
    ).toBeInTheDocument();
  });

  it("should show validation errors when the add goal form is submitted with missing required fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Your goals");

    fireEvent.click(screen.getByRole("button", { name: "Add goal" }));

    expect(await screen.findByText("Enter a goal name")).toBeInTheDocument();
    expect(
      screen.getByText("Invalid input: expected number, received NaN"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should create a goal and reload the list when the add goal form is valid", async () => {
    const updatedGoals = [
      buildGoal(),
      buildGoal({ id: 2, name: "New Car" }),
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildGoal()]))
      .mockResolvedValueOnce(jsonResponse({ id: 2 }, 201))
      .mockResolvedValueOnce(jsonResponse(updatedGoals));

    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Emergency Fund");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: " New Car " },
    });
    fireEvent.change(screen.getByLabelText("Target amount"), {
      target: { value: "15000.50" },
    });
    fireEvent.change(screen.getByLabelText("Target date"), {
      target: { value: "2027-06-15" },
    });
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "LOW" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/savings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "New Car",
          targetAmount: 15000.5,
          targetDate: "2027-06-15",
          priority: "LOW",
        }),
      });
    });

    expect(await screen.findByText("New Car")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("should omit the target date from the request body when it is left empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }, 201))
      .mockResolvedValueOnce(jsonResponse([buildGoal()]));

    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Your goals");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Fund" },
    });
    fireEvent.change(screen.getByLabelText("Target amount"), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/savings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Fund",
          targetAmount: 1000,
          priority: "MEDIUM",
        }),
      });
    });
  });

  it("should surface the API error when creating a goal fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Goal save failed" }, 500),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Your goals");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Fund" },
    });
    fireEvent.change(screen.getByLabelText("Target amount"), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add goal" }));

    expect(await screen.findByText("Goal save failed")).toBeInTheDocument();
  });

  it("should toggle the contribution form when the add contribution button is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([buildGoal()]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    const article = (await screen.findByText("Emergency Fund")).closest(
      "article",
    ) as HTMLElement;

    expect(
      within(article).queryByRole("button", { name: "Save contribution" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(article).getByRole("button", { name: "Add contribution" }),
    );

    expect(
      within(article).getByRole("button", { name: "Save contribution" }),
    ).toBeInTheDocument();
    expect(
      within(article).getByRole("button", { name: "Hide contribution form" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(article).getByRole("button", { name: "Hide contribution form" }),
    );

    expect(
      within(article).queryByRole("button", { name: "Save contribution" }),
    ).not.toBeInTheDocument();
  });

  it("should add a contribution with the default date and reload the goal list when the inline form is submitted", async () => {
    const updatedGoal = buildGoal({
      currentAmount: "1450",
      savingsContributions: [
        {
          id: 20,
          goalId: 1,
          amount: "200",
          contributionDate: `${today}T00:00:00.000Z`,
          note: "March savings",
          createdAt: `${today}T00:00:00.000Z`,
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildGoal()]))
      .mockResolvedValueOnce(jsonResponse({ id: 20 }, 201))
      .mockResolvedValueOnce(jsonResponse([updatedGoal]));

    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    const article = (await screen.findByText("Emergency Fund")).closest(
      "article",
    ) as HTMLElement;
    fireEvent.click(
      within(article).getByRole("button", { name: "Add contribution" }),
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: " March savings " },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save contribution" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/savings/1/contributions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            amount: 200,
            contributionDate: today,
            note: "March savings",
          }),
        },
      );
    });

    expect(await screen.findByText("March savings")).toBeInTheDocument();
    expect(screen.getByText("£200.00")).toBeInTheDocument();
  });

  it("should show a validation error when the contribution form is submitted without an amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([buildGoal()]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    const article = (await screen.findByText("Emergency Fund")).closest(
      "article",
    ) as HTMLElement;
    fireEvent.click(
      within(article).getByRole("button", { name: "Add contribution" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save contribution" }),
    );

    expect(
      await screen.findByText("Invalid input: expected number, received NaN"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should surface the API error when adding a contribution fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildGoal()]))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Contribution save failed" }, 500),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    const article = (await screen.findByText("Emergency Fund")).closest(
      "article",
    ) as HTMLElement;
    fireEvent.click(
      within(article).getByRole("button", { name: "Add contribution" }),
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "100" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save contribution" }),
    );

    expect(
      await screen.findByText("Contribution save failed"),
    ).toBeInTheDocument();
  });

  it("should delete a contribution and reload the goal list when the delete action succeeds", async () => {
    const goalWithContribution = buildGoal({
      savingsContributions: [
        {
          id: 20,
          goalId: 1,
          amount: "200",
          contributionDate: "2026-03-11T00:00:00.000Z",
          note: "March savings",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([goalWithContribution]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([buildGoal()]));

    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    const article = (await screen.findByText("Emergency Fund")).closest(
      "article",
    ) as HTMLElement;
    fireEvent.click(
      within(article).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/savings/1/contributions/20",
        {
          method: "DELETE",
        },
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("March savings")).not.toBeInTheDocument();
    });
  });

  it("should show the page error when deleting a contribution fails", async () => {
    const goalWithContribution = buildGoal({
      savingsContributions: [
        {
          id: 20,
          goalId: 1,
          amount: "200",
          contributionDate: "2026-03-11T00:00:00.000Z",
          note: "March savings",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([goalWithContribution]))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Delete failed" }, 500),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    const article = (await screen.findByText("Emergency Fund")).closest(
      "article",
    ) as HTMLElement;
    fireEvent.click(
      within(article).getByRole("button", { name: "Delete" }),
    );

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
  });

  it("should compute the summary correctly with zero goals", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("No savings goals have been added yet.");

    // Total saved should be £0.00
    expect(screen.getByText("£0.00")).toBeInTheDocument();
    // Active goals count 0
    expect(screen.getByText("0")).toBeInTheDocument();
    // Overall progress 0%
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("should not render breadcrumbs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavingsPage />);

    await screen.findByText("Your goals");

    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByText("Savings goals")).toBeInTheDocument();
  });
});
