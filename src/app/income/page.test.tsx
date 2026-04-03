// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IncomePage from "@/app/income/page";

vi.mock("@/lib/months", () => ({
  formatMonthLabel: (month: string) => {
    if (month === "2026-02") {
      return "February 2026";
    }

    if (month === "2026-03") {
      return "March 2026";
    }

    return month;
  },
}));

type IncomeDeductionFixture = {
  id: number;
  deductionType: "INCOME_TAX" | "NI" | "PENSION" | "STUDENT_LOAN" | "OTHER";
  name: string;
  amount: string;
  isPercentage: boolean;
  percentageValue: string | null;
  isActive: boolean;
  createdAt: string;
};

type IncomeEntryFixture = {
  id: number;
  incomeType: "SALARY" | "BONUS" | "GIFT" | "FREELANCE" | "OTHER";
  description: string | null;
  grossAmount: string;
  netAmount: string;
  incomeDate: string;
  isRecurring: boolean;
  recurrenceFrequency: "MONTHLY" | "WEEKLY" | "ANNUALLY" | "ONE_OFF" | null;
  isActive: boolean;
  createdAt: string;
  totalDeductions: string;
  incomeDeductions: IncomeDeductionFixture[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildDeduction(
  overrides: Partial<IncomeDeductionFixture> = {},
): IncomeDeductionFixture {
  return {
    id: 1,
    deductionType: "INCOME_TAX",
    name: "Income Tax",
    amount: "500",
    isPercentage: false,
    percentageValue: null,
    isActive: true,
    createdAt: "2026-03-11T09:00:00.000Z",
    ...overrides,
  };
}

function buildIncomeEntry(
  overrides: Partial<IncomeEntryFixture> = {},
): IncomeEntryFixture {
  const incomeDeductions = overrides.incomeDeductions ?? [buildDeduction()];
  const totalDeductions =
    overrides.totalDeductions ??
    incomeDeductions
      .reduce((sum, deduction) => sum + Number(deduction.amount), 0)
      .toString();

  return {
    id: 1,
    incomeType: "SALARY",
    description: null,
    grossAmount: "3500",
    netAmount: "3000",
    incomeDate: "2026-03-31T00:00:00.000Z",
    isRecurring: true,
    recurrenceFrequency: "MONTHLY",
    isActive: true,
    createdAt: "2026-03-11T09:00:00.000Z",
    totalDeductions,
    incomeDeductions,
    ...overrides,
  };
}

describe("[Component] income page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal("scrollTo", vi.fn());
  });

  it("should render an empty state when no income entries are returned", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/income") {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    expect(await screen.findByText("No income entries yet.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No deductions added. Use the button below if you want to record tax, pension, or other deductions.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/income", {
      cache: "no-store",
    });
  });

  it("should group entries by month and show deduction details when an entry is expanded", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/income") {
        return Promise.resolve(
          jsonResponse([
            buildIncomeEntry(),
            buildIncomeEntry({
              id: 2,
              incomeType: "BONUS",
              grossAmount: "1200",
              netAmount: "1200",
              incomeDate: "2026-02-15T00:00:00.000Z",
              isRecurring: false,
              recurrenceFrequency: null,
              incomeDeductions: [],
              totalDeductions: "0",
            }),
          ]),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    expect(await screen.findByText("March 2026")).toBeInTheDocument();
    expect(screen.getByText("February 2026")).toBeInTheDocument();
    expect(screen.getByText("Gross £3,500.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /salary31 mar 2026/i }));

    expect(await screen.findByText("Deduction breakdown")).toBeInTheDocument();
    expect(screen.getAllByText("Income Tax").length).toBeGreaterThan(1);
    expect(screen.getByText("Recurring")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
  });

  it("should update the live summary when gross and deduction values change", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    await screen.findByText("No income entries yet.");

    fireEvent.change(screen.getByLabelText("Gross amount"), {
      target: { value: "4000" },
    });
    fireEvent.change(screen.getByLabelText("Net amount"), {
      target: { value: "3200" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add deduction" }));

    const nameInputs = screen.getAllByPlaceholderText("Enter name");
    fireEvent.change(nameInputs[0], {
      target: { value: "Income Tax" },
    });

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "800" },
    });

    expect(screen.getAllByText("£800.00").length).toBeGreaterThan(0);
    expect(screen.getByText("£3,200.00")).toBeInTheDocument();
    expect(screen.getByText("Entered net matches the deduction summary.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Net amount"), {
      target: { value: "3100" },
    });

    expect(
      screen.getByText("Entered net does not match by £100.00."),
    ).toBeInTheDocument();
  });

  it("should show a negative calculated net when deductions exceed the gross amount", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    await screen.findByText("No income entries yet.");

    fireEvent.change(screen.getByLabelText("Gross amount"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Net amount"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add deduction" }));
    fireEvent.change(screen.getAllByPlaceholderText("Enter name")[0], {
      target: { value: "Income Tax" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "700" },
    });

    expect(screen.getAllByText("-£200.00").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Entered net does not match by £200.00."),
    ).toBeInTheDocument();
  });

  it("should show a validation error when recurring income is submitted without a frequency", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    await screen.findByText("No income entries yet.");

    fireEvent.change(screen.getByLabelText("Gross amount"), {
      target: { value: "4000" },
    });
    fireEvent.change(screen.getByLabelText("Net amount"), {
      target: { value: "3200" },
    });
    fireEvent.click(screen.getByLabelText("Recurring income"));
    fireEvent.click(screen.getByRole("button", { name: "Add deduction" }));
    fireEvent.change(screen.getAllByPlaceholderText("Enter name")[0], {
      target: { value: "Income Tax" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "800" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log income" }));

    expect(await screen.findByText("Select a frequency")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should submit a new income entry with recurring deductions and reload the list", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/income" && init?.method === undefined) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/income" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            buildIncomeEntry({
              grossAmount: "4000",
              netAmount: "3200",
              incomeDeductions: [
                buildDeduction({
                  id: 10,
                  name: "Income Tax",
                  amount: "800",
                }),
              ],
              totalDeductions: "800",
            }),
            201,
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    await screen.findByText("No income entries yet.");

    fireEvent.change(screen.getByLabelText("Gross amount"), {
      target: { value: "4000" },
    });
    fireEvent.change(screen.getByLabelText("Net amount"), {
      target: { value: "3200" },
    });
    fireEvent.click(screen.getByLabelText("Recurring income"));
    fireEvent.change(screen.getByLabelText("Frequency"), {
      target: { value: "MONTHLY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add deduction" }));
    fireEvent.change(screen.getAllByPlaceholderText("Enter name")[0], {
      target: { value: " Income Tax " },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "800" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log income" }));
    let postCall: [RequestInfo | URL, RequestInit | undefined] | undefined;

    await waitFor(() => {
      postCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url) === "/api/income" && init?.method === "POST",
      );
      expect(postCall).toBeDefined();
    });

    expect(postCall?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });

    const postBody = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(postBody).toMatchObject({
      incomeType: "SALARY",
      grossAmount: 4000,
      netAmount: 3200,
      isRecurring: true,
      recurrenceFrequency: "MONTHLY",
      deductions: [
        {
          deductionType: "INCOME_TAX",
          name: "Income Tax",
          amount: 800,
        },
      ],
    });
    expect(postBody.incomeDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(screen.getByText("Entered net matches the deduction summary.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No deductions added. Use the button below if you want to record tax, pension, or other deductions.",
      ),
    ).toBeInTheDocument();
  });

  it("should submit a new income entry without deductions when none are added", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/income" && init?.method === undefined) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/income" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            buildIncomeEntry({
              grossAmount: "1800",
              netAmount: "1800",
              isRecurring: false,
              recurrenceFrequency: null,
              incomeDeductions: [],
              totalDeductions: "0",
            }),
            201,
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    await screen.findByText("No income entries yet.");

    fireEvent.change(screen.getByLabelText("Gross amount"), {
      target: { value: "1800" },
    });
    fireEvent.change(screen.getByLabelText("Net amount"), {
      target: { value: "1800" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log income" }));

    let postCall: [RequestInfo | URL, RequestInit | undefined] | undefined;

    await waitFor(() => {
      postCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url) === "/api/income" && init?.method === "POST",
      );
      expect(postCall).toBeDefined();
    });

    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      incomeType: "SALARY",
      grossAmount: 1800,
      netAmount: 1800,
      isRecurring: false,
      deductions: [],
    });
  });

  it("should populate the form for editing and submit a PUT request that clears recurrence frequency", async () => {
    const existingEntry = buildIncomeEntry();
    let getCount = 0;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/income" && init?.method === undefined) {
        getCount += 1;
        return Promise.resolve(jsonResponse([existingEntry]));
      }

      if (url === "/api/income/1" && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse(
            buildIncomeEntry({
              isRecurring: false,
              recurrenceFrequency: null,
            }),
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    expect(await screen.findByText("March 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("heading", { name: "Edit income entry" })).toBeInTheDocument();
    expect(screen.getByLabelText("Gross amount")).toHaveValue(3500);
    expect(screen.getAllByPlaceholderText("Enter name")[0]).toHaveValue("Income Tax");

    fireEvent.click(screen.getByLabelText("Recurring income"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    let putCall: [RequestInfo | URL, RequestInit | undefined] | undefined;

    await waitFor(() => {
      putCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url) === "/api/income/1" && init?.method === "PUT",
      );
      expect(putCall).toBeDefined();
    });

    expect(putCall?.[1]).toMatchObject({
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
    });
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({
      incomeType: "SALARY",
      grossAmount: 3500,
      netAmount: 3000,
      incomeDate: "2026-03-31T00:00:00.000Z",
      isRecurring: false,
      recurrenceFrequency: null,
      deductions: [
        {
          deductionType: "INCOME_TAX",
          name: "Income Tax",
          amount: 500,
        },
      ],
    });

    expect(getCount).toBe(2);
  });

  it("should delete an income entry and refresh the grouped list", async () => {
    let entries = [buildIncomeEntry()];

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/income" && init?.method === undefined) {
        return Promise.resolve(jsonResponse(entries));
      }

      if (url === "/api/income/1" && init?.method === "DELETE") {
        entries = [];
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    expect(await screen.findByText("March 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/income/1", {
        method: "DELETE",
      });
    });

    expect(await screen.findByText("No income entries yet.")).toBeInTheDocument();
  });

  it("should disable autofill on the income date input", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/income") {
        return Promise.resolve(jsonResponse([]));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    expect(await screen.findByLabelText("Income date")).toHaveAttribute(
      "autocomplete",
      "off",
    );
  });

  it("should show a load error when the income request fails", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ error: "Income API unavailable" }, 500)),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    expect(await screen.findByText("Income API unavailable")).toBeInTheDocument();
  });

  it("should add and remove deduction rows inline", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse([])));
    vi.stubGlobal("fetch", fetchMock);

    render(<IncomePage />);

    await screen.findByText("No income entries yet.");
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add deduction" }));
    expect(screen.getAllByPlaceholderText("Enter name")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByPlaceholderText("Enter name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "No deductions added. Use the button below if you want to record tax, pension, or other deductions.",
      ),
    ).toBeInTheDocument();
  });
});
