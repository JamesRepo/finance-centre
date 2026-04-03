// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HolidaysPage from "@/app/holidays/page";

type HolidayExpenseType =
  | "FLIGHT"
  | "ACCOMMODATION"
  | "FOOD"
  | "TRANSPORT"
  | "ACTIVITY"
  | "SHOPPING"
  | "OTHER";

type HolidaySummaryFixture = {
  id: number;
  name: string;
  destination: string;
  assignedMonth: string;
  startDate: string;
  endDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  totalCost: string;
  expenseCount: number;
  expenseBreakdown: Array<{
    expenseType: HolidayExpenseType;
    totalCost: string;
  }>;
};

type HolidayDetailFixture = HolidaySummaryFixture & {
  holidayExpenses: Array<{
    id: number;
    holidayId: number;
    expenseType: HolidayExpenseType;
    description: string;
    amount: string;
    expenseDate: string;
    notes: string | null;
    createdAt: string;
  }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function buildHolidaySummary(
  overrides: Partial<HolidaySummaryFixture> = {},
): HolidaySummaryFixture {
  return {
    id: 1,
    name: "Japan Spring",
    destination: "Tokyo",
    assignedMonth: "2099-03",
    startDate: "2099-03-20T00:00:00.000Z",
    endDate: "2099-03-28T00:00:00.000Z",
    description: "Cherry blossom trip",
    isActive: true,
    createdAt: "2099-03-01T00:00:00.000Z",
    totalCost: "1200",
    expenseCount: 2,
    expenseBreakdown: [
      {
        expenseType: "FLIGHT",
        totalCost: "900",
      },
      {
        expenseType: "FOOD",
        totalCost: "300",
      },
    ],
    ...overrides,
  };
}

function buildHolidayDetail(
  overrides: Partial<HolidayDetailFixture> = {},
): HolidayDetailFixture {
  const base = buildHolidaySummary();

  return {
    ...base,
    holidayExpenses: [
      {
        id: 10,
        holidayId: base.id,
        expenseType: "FLIGHT",
        description: "Outbound flight",
        amount: "900",
        expenseDate: "2099-03-20T00:00:00.000Z",
        notes: "Direct flight",
        createdAt: "2099-03-01T00:00:00.000Z",
      },
      {
        id: 11,
        holidayId: base.id,
        expenseType: "FOOD",
        description: "Sushi dinner",
        amount: "300",
        expenseDate: "2099-03-21T00:00:00.000Z",
        notes: null,
        createdAt: "2099-03-02T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("[Component] holidays page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should fetch holidays and render summary cards with active holidays before past holidays when the page loads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        buildHolidaySummary({
          id: 2,
          name: "Lisbon Weekend",
          destination: "Lisbon",
          startDate: "2000-02-01T00:00:00.000Z",
          endDate: "2000-02-04T00:00:00.000Z",
          totalCost: "500",
          expenseCount: 1,
          expenseBreakdown: [{ expenseType: "FLIGHT", totalCost: "500" }],
        }),
        buildHolidaySummary({
          id: 1,
          name: "Japan Spring",
          totalCost: "1200",
          expenseCount: 2,
        }),
      ]),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    expect(await screen.findByText("Japan Spring")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/holidays", {
      cache: "no-store",
    });
    expect(
      within(
        screen.getByText("Total holidays tracked").closest("div") as HTMLElement,
      ).getByText("2"),
    ).toBeInTheDocument();
    expect(screen.getByText("£1,700.00")).toBeInTheDocument();
    expect(screen.getByText("£850.00")).toBeInTheDocument();

    const holidayHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(holidayHeadings.map((heading) => heading.textContent)).toEqual([
      "Japan Spring",
      "Lisbon Weekend",
    ]);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Past")).toBeInTheDocument();
    expect(screen.getAllByText("Assigned to March 2099")).toHaveLength(2);
  });

  it("should render the empty state when no holidays exist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    expect(
      await screen.findByText("No holidays have been added yet."),
    ).toBeInTheDocument();
  });

  it("should render an error message when the initial holidays request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "Holiday API unavailable" }, 500),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    expect(
      await screen.findByText("Holiday API unavailable"),
    ).toBeInTheDocument();
  });

  it("should show validation errors when the holiday form is submitted without required fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    await screen.findByText("No holidays have been added yet.");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Destination"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add holiday" }));

    expect(await screen.findByText("Enter a holiday name")).toBeInTheDocument();
    expect(screen.getByText("Enter a destination")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should create a holiday and append it to the list when the form is valid", async () => {
    const createdHoliday = buildHolidaySummary({
      id: 3,
      name: "Rome Escape",
      destination: "Rome",
      startDate: "2026-04-10T00:00:00.000Z",
      endDate: "2026-04-15T00:00:00.000Z",
      description: "City break",
      totalCost: "0",
      expenseCount: 0,
      expenseBreakdown: [],
      assignedMonth: "2026-04",
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdHoliday, 201));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    await screen.findByText("No holidays have been added yet.");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: " Rome Escape " },
    });
    fireEvent.change(screen.getByLabelText("Destination"), {
      target: { value: " Rome " },
    });
    fireEvent.change(screen.getByLabelText("Assigned month"), {
      target: { value: "2026-04" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-04-10" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-04-15" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: " City break " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add holiday" }));

    expect(await screen.findByText("Rome Escape")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/holidays", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Rome Escape",
        destination: "Rome",
        assignedMonth: "2026-04",
        startDate: "2026-04-10",
        endDate: "2026-04-15",
        description: "City break",
      }),
    });
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Destination")).toHaveValue("");
    expect(screen.getByLabelText("Assigned month")).toHaveValue(
      new Date().toISOString().slice(0, 7),
    );
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });

  it("should clear the initial load error and show the new holiday when create succeeds after a failed list request", async () => {
    const createdHoliday = buildHolidaySummary({
      id: 4,
      name: "Athens Escape",
      destination: "Athens",
      startDate: "2026-05-10T00:00:00.000Z",
      endDate: "2026-05-15T00:00:00.000Z",
      description: "Sunny break",
      totalCost: "0",
      expenseCount: 0,
      expenseBreakdown: [],
      assignedMonth: "2026-05",
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Holiday API unavailable" }, 500))
      .mockResolvedValueOnce(jsonResponse(createdHoliday, 201));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    expect(
      await screen.findByText("Holiday API unavailable"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Athens Escape" },
    });
    fireEvent.change(screen.getByLabelText("Destination"), {
      target: { value: "Athens" },
    });
    fireEvent.change(screen.getByLabelText("Assigned month"), {
      target: { value: "2026-05" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-05-10" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-05-15" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Sunny break" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add holiday" }));

    expect(await screen.findByText("Athens Escape")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Holiday API unavailable")).not.toBeInTheDocument();
    });
  });

  it("should show a validation error when assigned month is cleared before submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    await screen.findByText("No holidays have been added yet.");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Rome Escape" },
    });
    fireEvent.change(screen.getByLabelText("Destination"), {
      target: { value: "Rome" },
    });
    fireEvent.change(screen.getByLabelText("Assigned month"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add holiday" }));

    expect(await screen.findByText("Enter a month in YYYY-MM format")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should load holiday details when a holiday card is expanded", async () => {
    const detail = buildHolidayDetail();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(detail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    fireEvent.click(holidayButton);

    expect(await screen.findByText("Outbound flight")).toBeInTheDocument();
    expect(screen.getByText("Sushi dinner")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/holidays/1", {
      cache: "no-store",
    });
  });

  it("should update the holiday name and travel dates when the inline holiday editor is saved", async () => {
    const initialDetail = buildHolidayDetail();
    const updatedDetail = buildHolidayDetail({
      name: "Japan Autumn",
      startDate: "2099-10-03T00:00:00.000Z",
      endDate: "2099-10-15T00:00:00.000Z",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(initialDetail))
      .mockResolvedValueOnce(jsonResponse(updatedDetail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByDisplayValue("Japan Spring");

    fireEvent.change(within(holidayCard).getByLabelText("Name"), {
      target: { value: "Japan Autumn" },
    });
    fireEvent.change(within(holidayCard).getByLabelText("Start date"), {
      target: { value: "2099-10-03" },
    });
    fireEvent.change(within(holidayCard).getByLabelText("End date"), {
      target: { value: "2099-10-15" },
    });
    fireEvent.click(within(holidayCard).getByRole("button", { name: "Save holiday" }));

    await within(holidayCard).findByText("Japan Autumn");
    expect(within(holidayCard).getByText("3 Oct 2099 to 15 Oct 2099")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/holidays/1", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Japan Autumn",
        startDate: "2099-10-03",
        endDate: "2099-10-15",
      }),
    });
  });

  it("should show a validation error when the inline holiday editor is submitted with an end date before the start date", async () => {
    const initialDetail = buildHolidayDetail();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(initialDetail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByDisplayValue("Japan Spring");

    fireEvent.change(within(holidayCard).getByLabelText("Start date"), {
      target: { value: "2099-03-28" },
    });
    fireEvent.change(within(holidayCard).getByLabelText("End date"), {
      target: { value: "2099-03-20" },
    });
    fireEvent.click(within(holidayCard).getByRole("button", { name: "Save holiday" }));

    expect(
      await within(holidayCard).findByText("End date must be on or after start date"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should show an error when updating the holiday details fails", async () => {
    const initialDetail = buildHolidayDetail();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(initialDetail))
      .mockResolvedValueOnce(jsonResponse({ error: "Failed to update holiday" }, 500));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByDisplayValue("Japan Spring");

    fireEvent.change(within(holidayCard).getByLabelText("Name"), {
      target: { value: "Japan Autumn" },
    });
    fireEvent.click(within(holidayCard).getByRole("button", { name: "Save holiday" }));

    expect(
      await within(holidayCard).findByText("Failed to update holiday"),
    ).toBeInTheDocument();
    expect(screen.getByText("Japan Spring")).toBeInTheDocument();
  });

  it("should save holiday details when the assigned month draft is invalid", async () => {
    const initialDetail = buildHolidayDetail();
    const updatedDetail = buildHolidayDetail({
      name: "Japan Autumn",
      startDate: "2099-10-03T00:00:00.000Z",
      endDate: "2099-10-15T00:00:00.000Z",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(initialDetail))
      .mockResolvedValueOnce(jsonResponse(updatedDetail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByDisplayValue("Japan Spring");

    fireEvent.change(within(holidayCard).getByLabelText("Assigned month"), {
      target: { value: "" },
    });
    fireEvent.change(within(holidayCard).getByLabelText("Name"), {
      target: { value: "Japan Autumn" },
    });
    fireEvent.change(within(holidayCard).getByLabelText("Start date"), {
      target: { value: "2099-10-03" },
    });
    fireEvent.change(within(holidayCard).getByLabelText("End date"), {
      target: { value: "2099-10-15" },
    });
    fireEvent.click(within(holidayCard).getByRole("button", { name: "Save holiday" }));

    await within(holidayCard).findByText("Japan Autumn");
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/holidays/1", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Japan Autumn",
        startDate: "2099-10-03",
        endDate: "2099-10-15",
      }),
    });
    expect(within(holidayCard).queryByText("Enter a month in YYYY-MM format")).not.toBeInTheDocument();
  });

  it("should update the assigned month for an existing holiday when the save succeeds", async () => {
    const initialDetail = buildHolidayDetail();
    const updatedDetail = buildHolidayDetail({
      assignedMonth: "2099-04",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(initialDetail))
      .mockResolvedValueOnce(jsonResponse(updatedDetail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByDisplayValue("2099-03");

    fireEvent.change(within(holidayCard).getByLabelText("Assigned month"), {
      target: { value: "2099-04" },
    });
    fireEvent.click(
      within(holidayCard).getByRole("button", { name: "Save assigned month" }),
    );

    await within(holidayCard).findByText("Assigned to April 2099");

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/holidays/1", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        assignedMonth: "2099-04",
      }),
    });
  });

  it("should show an error when updating the assigned month for an existing holiday fails", async () => {
    const initialDetail = buildHolidayDetail();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(initialDetail))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Failed to update assigned month" }, 500),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByDisplayValue("2099-03");

    fireEvent.change(within(holidayCard).getByLabelText("Assigned month"), {
      target: { value: "2099-04" },
    });
    fireEvent.click(
      within(holidayCard).getByRole("button", { name: "Save assigned month" }),
    );

    expect(
      await within(holidayCard).findByText("Failed to update assigned month"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Assigned to March 2099")).toHaveLength(1);
  });

  it("should show an expense validation error when the inline expense form is submitted with missing required fields", async () => {
    const detail = buildHolidayDetail({
      holidayExpenses: [],
      totalCost: "0",
      expenseCount: 0,
      expenseBreakdown: [],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(detail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByText(
      "Log travel costs directly against this holiday.",
    );

    fireEvent.click(within(holidayCard).getByRole("button", { name: "Add expense" }));

    expect(await screen.findByText("Enter a description")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should add an expense and refresh the holiday details when the inline expense form is valid", async () => {
    const initialSummary = buildHolidaySummary({
      totalCost: "1200",
      expenseCount: 2,
    });
    const initialDetail = buildHolidayDetail();
    const refreshedDetail = buildHolidayDetail({
      totalCost: "1255",
      expenseCount: 3,
      expenseBreakdown: [
        { expenseType: "FLIGHT", totalCost: "900" },
        { expenseType: "FOOD", totalCost: "300" },
        { expenseType: "TRANSPORT", totalCost: "55" },
      ],
      holidayExpenses: [
        ...buildHolidayDetail().holidayExpenses,
        {
          id: 12,
          holidayId: 1,
          expenseType: "TRANSPORT",
          description: "Metro tickets",
          amount: "55",
          expenseDate: "2099-03-22T00:00:00.000Z",
          notes: "Airport transfer",
          createdAt: "2099-03-03T00:00:00.000Z",
        },
      ],
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([initialSummary]))
      .mockResolvedValueOnce(jsonResponse(initialDetail))
      .mockResolvedValueOnce(jsonResponse({}, 201))
      .mockResolvedValueOnce(jsonResponse(refreshedDetail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByText(
      "Log travel costs directly against this holiday.",
    );

    fireEvent.change(within(holidayCard).getByLabelText("Description"), {
      target: { value: " Metro tickets " },
    });
    fireEvent.change(within(holidayCard).getByLabelText("Amount"), {
      target: { value: "55" },
    });
    fireEvent.change(within(holidayCard).getByLabelText("Notes"), {
      target: { value: " Airport transfer " },
    });
    fireEvent.change(within(holidayCard).getByLabelText("Type"), {
      target: { value: "TRANSPORT" },
    });

    const addExpenseButton = within(holidayCard).getByRole("button", {
      name: "Add expense",
    });
    fireEvent.click(addExpenseButton);

    await screen.findByText("Metro tickets");

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/holidays/1/expenses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        expenseType: "TRANSPORT",
        description: "Metro tickets",
        amount: 55,
        expenseDate: "2099-03-20",
        notes: "Airport transfer",
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/holidays/1", {
      cache: "no-store",
    });
    expect(within(holidayCard).getByText("£1,255.00")).toBeInTheDocument();
  });

  it("should delete an expense and refresh the holiday details when delete is clicked", async () => {
    const initialDetail = buildHolidayDetail();
    const refreshedDetail = buildHolidayDetail({
      totalCost: "900",
      expenseCount: 1,
      expenseBreakdown: [{ expenseType: "FLIGHT", totalCost: "900" }],
      holidayExpenses: [buildHolidayDetail().holidayExpenses[0]],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(initialDetail))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(refreshedDetail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    const holidayButton = await screen.findByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByText("Outbound flight");

    fireEvent.click(within(holidayCard).getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => {
      expect(screen.queryByText("Sushi dinner")).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/holidays/1/expenses/10", {
      method: "DELETE",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/holidays/1", {
      cache: "no-store",
    });
  });

  it("should have autofill prevention attributes on holiday date and month inputs", async () => {
    const detail = buildHolidayDetail();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([buildHolidaySummary()]))
      .mockResolvedValueOnce(jsonResponse(detail));

    vi.stubGlobal("fetch", fetchMock);

    render(<HolidaysPage />);

    expect(await screen.findByLabelText("Assigned month")).toHaveAttribute(
      "autocomplete",
      "off",
    );
    expect(screen.getByLabelText("Start date")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("End date")).toHaveAttribute("autocomplete", "off");

    const holidayButton = screen.getByRole("button", { name: /Japan Spring/i });
    const holidayCard = holidayButton.closest("article") as HTMLElement;
    fireEvent.click(holidayButton);
    await within(holidayCard).findByText("Holiday details");

    const holidayDetailsSection = within(holidayCard)
      .getByText("Holiday details")
      .closest("div")?.parentElement as HTMLElement;
    expect(within(holidayDetailsSection).getByLabelText("Start date")).toHaveAttribute(
      "autocomplete",
      "off",
    );
    expect(within(holidayDetailsSection).getByLabelText("End date")).toHaveAttribute(
      "autocomplete",
      "off",
    );

    expect(within(holidayCard).getByLabelText("Assigned month")).toHaveAttribute(
      "autocomplete",
      "off",
    );
    expect(within(holidayCard).getByLabelText("Date")).toHaveAttribute(
      "autocomplete",
      "off",
    );
  });
});
