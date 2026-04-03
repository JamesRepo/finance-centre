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
import DebtsPage from "@/app/debts/page";

const today = format(new Date(), "yyyy-MM-dd");

function buildDebt(overrides: Partial<DebtFixture> = {}): DebtFixture {
  return {
    id: 1,
    name: "Visa",
    debtType: "CREDIT_CARD",
    originalBalance: "1000",
    interestRate: "19.99",
    minimumPayment: "35",
    startDate: "2026-01-01T00:00:00.000Z",
    targetPayoffDate: "2026-12-31T00:00:00.000Z",
    isActive: true,
    notes: "Main card",
    createdAt: "2026-03-01T00:00:00.000Z",
    debtPayments: [],
    totalPaid: "200",
    totalInterestPaid: "20",
    principalPaid: "180",
    paymentCount: 0,
    currentBalance: "800",
    ...overrides,
  };
}

type DebtFixture = {
  id: number;
  name: string;
  debtType: "CREDIT_CARD" | "STUDENT_LOAN" | "PERSONAL_LOAN" | "OTHER";
  originalBalance: string;
  interestRate: string;
  minimumPayment: string | null;
  startDate: string | null;
  targetPayoffDate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  debtPayments: Array<{
    id: number;
    debtId: number;
    amount: string;
    interestAmount: string;
    paymentDate: string;
    note: string | null;
    createdAt: string;
  }>;
  totalPaid: string;
  totalInterestPaid: string;
  principalPaid: string;
  paymentCount: number;
  currentBalance: string;
};

describe("[Component] debts page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("should fetch debts and render the summary using active balances when the page loads", async () => {
    const debts = [
      buildDebt({
        debtPayments: [
          {
            id: 15,
            debtId: 1,
            amount: "20",
            interestAmount: "2",
            paymentDate: "2026-03-11T00:00:00.000Z",
            note: "Latest payment",
            createdAt: "2026-03-11T00:00:00.000Z",
          },
          {
            id: 14,
            debtId: 1,
            amount: "15",
            interestAmount: "1",
            paymentDate: "2026-03-10T00:00:00.000Z",
            note: "Payment 5",
            createdAt: "2026-03-10T00:00:00.000Z",
          },
          {
            id: 13,
            debtId: 1,
            amount: "14",
            interestAmount: "1",
            paymentDate: "2026-03-09T00:00:00.000Z",
            note: "Payment 4",
            createdAt: "2026-03-09T00:00:00.000Z",
          },
          {
            id: 12,
            debtId: 1,
            amount: "13",
            interestAmount: "1",
            paymentDate: "2026-03-08T00:00:00.000Z",
            note: "Payment 3",
            createdAt: "2026-03-08T00:00:00.000Z",
          },
          {
            id: 11,
            debtId: 1,
            amount: "12",
            interestAmount: "1",
            paymentDate: "2026-03-07T00:00:00.000Z",
            note: "Payment 2",
            createdAt: "2026-03-07T00:00:00.000Z",
          },
          {
            id: 10,
            debtId: 1,
            amount: "11",
            interestAmount: "1",
            paymentDate: "2026-03-06T00:00:00.000Z",
            note: "Oldest hidden payment",
            createdAt: "2026-03-06T00:00:00.000Z",
          },
        ],
      }),
      buildDebt({
        id: 2,
        name: "Archived Student Loan",
        debtType: "STUDENT_LOAN",
        originalBalance: "1200",
        totalPaid: "100",
        totalInterestPaid: "0",
        principalPaid: "100",
        currentBalance: "1100",
        isActive: false,
        debtPayments: [],
        minimumPayment: null,
        notes: null,
      }),
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(debts), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    expect(await screen.findByText("Visa")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/debts", {
      cache: "no-store",
    });
    expect(screen.getAllByText("£800.00")).toHaveLength(2);
    expect(screen.getByText("£300.00")).toBeInTheDocument();
    expect(screen.getByText("Active debts")).toBeInTheDocument();
    expect(screen.queryByText("Archived Student Loan")).not.toBeInTheDocument();
    expect(screen.getByText("Latest payment")).toBeInTheDocument();
    expect(screen.queryByText("Oldest hidden payment")).not.toBeInTheDocument();
  });

  it("should disable autofill on debt date inputs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([buildDebt()]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    expect(await screen.findByLabelText("Start date")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("Target payoff date")).toHaveAttribute(
      "autocomplete",
      "off",
    );

    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));
    expect(await screen.findByLabelText("Date")).toHaveAttribute("autocomplete", "off");
  });

  it("should show inactive debts when the toggle is enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          buildDebt(),
          buildDebt({
            id: 2,
            name: "Archived Loan",
            debtType: "PERSONAL_LOAN",
            isActive: false,
            currentBalance: "0",
            totalPaid: "800",
            totalInterestPaid: "0",
            principalPaid: "800",
            originalBalance: "800",
          }),
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    await screen.findByText("Visa");

    fireEvent.click(screen.getByLabelText("Show inactive debts"));

    expect(await screen.findByText("Archived Loan")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("should show the archived empty state when no active debts exist and inactive debts are hidden", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          buildDebt({
            id: 2,
            name: "Archived Loan",
            isActive: false,
            currentBalance: "0",
            totalPaid: "800",
            totalInterestPaid: "0",
            principalPaid: "800",
            originalBalance: "800",
          }),
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    expect(
      await screen.findByText(
        "No active debts found. Toggle inactive debts to view archived accounts.",
      ),
    ).toBeInTheDocument();
  });

  it("should show validation errors when the add debt form is submitted with missing required fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    await screen.findByText("Debt accounts");

    fireEvent.click(screen.getByRole("button", { name: "Add debt" }));

    expect(await screen.findByText("Enter a debt name")).toBeInTheDocument();
    expect(
      screen.getAllByText("Invalid input: expected number, received NaN"),
    ).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should create a debt and reload the list when the add debt form is valid", async () => {
    const updatedDebts = [buildDebt(), buildDebt({ id: 3, name: "Barclaycard" })];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([buildDebt()]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 3 }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedDebts), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    await screen.findByText("Visa");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: " Barclaycard " },
    });
    fireEvent.change(screen.getByLabelText("Debt type"), {
      target: { value: "CREDIT_CARD" },
    });
    fireEvent.change(screen.getByLabelText("Original balance"), {
      target: { value: "2500.75" },
    });
    fireEvent.change(screen.getByLabelText("Interest rate (%)"), {
      target: { value: "19.99" },
    });
    fireEvent.change(screen.getByLabelText("Minimum payment"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-01-15" },
    });
    fireEvent.change(screen.getByLabelText("Target payoff date"), {
      target: { value: "2026-12-15" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: " Main card " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add debt" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/debts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Barclaycard",
          debtType: "CREDIT_CARD",
          originalBalance: 2500.75,
          interestRate: 19.99,
          minimumPayment: 50,
          startDate: "2026-01-15",
          targetPayoffDate: "2026-12-15",
          notes: "Main card",
        }),
      });
    });

    expect(await screen.findByText("Barclaycard")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("should surface the API error when creating a debt fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Debt save failed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    await screen.findByText("Debt accounts");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Visa" },
    });
    fireEvent.change(screen.getByLabelText("Original balance"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("Interest rate (%)"), {
      target: { value: "19.99" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add debt" }));

    expect(await screen.findByText("Debt save failed")).toBeInTheDocument();
  });

  it("should add a payment with the default date and reload the debt list when the inline form is submitted", async () => {
    const updatedDebt = buildDebt({
      totalPaid: "275",
      totalInterestPaid: "35",
      principalPaid: "240",
      currentBalance: "725",
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: `${today}T00:00:00.000Z`,
          note: "March payment",
          createdAt: `${today}T00:00:00.000Z`,
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([buildDebt()]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 21 }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([updatedDebt]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Add payment",
      }),
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "75" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: " March payment " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/debts/1/payments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: 75,
          interestAmount: 0,
          paymentDate: today,
          note: "March payment",
        }),
      });
    });

    expect(await screen.findByText("March payment")).toBeInTheDocument();
    expect(screen.getByText("Interest £15.00 · Principal £60.00")).toBeInTheDocument();
    expect(screen.getAllByText("£725.00")).toHaveLength(2);
  });

  it("should show a validation error when the payment form is submitted without an amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([buildDebt()]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Add payment",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));

    expect(
      await screen.findByText("Invalid input: expected number, received NaN"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should delete a recent payment and reload the debt list when the delete action succeeds", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([debtWithPayment]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([buildDebt()]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/debts/1/payments/21",
        {
          method: "DELETE",
        },
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("March payment")).not.toBeInTheDocument();
    });
  });

  it("should show a pre-populated inline edit form when Edit is clicked for a payment", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([debtWithPayment]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(screen.getByDisplayValue("75")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-11")).toBeInTheDocument();
    expect(screen.getByDisplayValue("March payment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should close the payment edit form when Cancel is clicked", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([debtWithPayment]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByText("March payment")).toBeInTheDocument();
  });

  it("should update a payment and reload the debt list when the inline edit form is submitted", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const updatedDebt = buildDebt({
      totalPaid: "285",
      totalInterestPaid: "35",
      principalPaid: "250",
      currentBalance: "750",
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "85",
          interestAmount: "15",
          paymentDate: "2026-03-12T00:00:00.000Z",
          note: "Updated March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([debtWithPayment]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 21 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([updatedDebt]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "85" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-03-12" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: " Updated March payment " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/debts/1/payments/21", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: 85,
          interestAmount: 15,
          paymentDate: "2026-03-12",
          note: "Updated March payment",
        }),
      });
    });

    expect(await screen.findByText("Updated March payment")).toBeInTheDocument();
    expect(screen.getByText("Interest £15.00 · Principal £70.00")).toBeInTheDocument();
    expect(screen.getAllByText("£750.00")).toHaveLength(2);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });
  });

  it("should clear an existing payment note when the inline edit form is submitted with a blank note", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const updatedDebt = buildDebt({
      totalPaid: "285",
      totalInterestPaid: "35",
      principalPaid: "250",
      currentBalance: "750",
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "85",
          interestAmount: "15",
          paymentDate: "2026-03-12T00:00:00.000Z",
          note: null,
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([debtWithPayment]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 21 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([updatedDebt]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "85" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-03-12" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/debts/1/payments/21", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: 85,
          interestAmount: 15,
          paymentDate: "2026-03-12",
          note: null,
        }),
      });
    });

    expect(await screen.findByText("No note")).toBeInTheDocument();
    expect(screen.queryByText("March payment")).not.toBeInTheDocument();
  });

  it("should show a validation error when the payment edit form is submitted without an amount", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([debtWithPayment]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Invalid input: expected number, received NaN"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should show the edit error and keep the form open when updating a payment fails", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([debtWithPayment]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Update failed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Update failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should show the page error when deleting a payment fails", async () => {
    const debtWithPayment = buildDebt({
      debtPayments: [
        {
          id: 21,
          debtId: 1,
          amount: "75",
          interestAmount: "15",
          paymentDate: "2026-03-11T00:00:00.000Z",
          note: "March payment",
          createdAt: "2026-03-11T00:00:00.000Z",
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([debtWithPayment]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Delete failed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    const debtCard = await screen.findByText("Visa");
    fireEvent.click(
      within(debtCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Delete",
      }),
    );

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
  });

  it("should show an error message when the initial debts request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Debt API unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsPage />);

    expect(await screen.findByText("Debt API unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Visa")).not.toBeInTheDocument();
  });
});
