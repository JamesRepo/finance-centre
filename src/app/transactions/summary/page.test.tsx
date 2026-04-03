// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import TransactionSummaryPage from "@/app/transactions/summary/page";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="bar-chart">
      <div data-testid="bar-chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  Bar: ({ children, dataKey }: { children?: React.ReactNode; dataKey: string }) => (
    <div data-testid={`bar-${dataKey}`}>{children}</div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
}));

describe("[Component] transaction summary page — static rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("should render period tabs (Monthly, Yearly, Weekly)", () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      return new Promise(() => {});
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<TransactionSummaryPage />);

    expect(screen.getByRole("button", { name: "Monthly" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yearly" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weekly" })).toBeInTheDocument();
  });

  it("should disable autofill on the month picker for monthly summaries", () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      return new Promise(() => {});
    });

    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<TransactionSummaryPage />);

    expect(container.querySelector('input[type="month"]')).toHaveAttribute(
      "autocomplete",
      "off",
    );
  });

  it("should render a back link to transactions page", () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      return new Promise(() => {});
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<TransactionSummaryPage />);

    const link = screen.getByRole("link", { name: "Back to transactions" });
    expect(link).toHaveAttribute("href", "/transactions");
  });

  it("should show loading state on initial render", () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      return new Promise(() => {});
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<TransactionSummaryPage />);

    expect(screen.getByText("Loading summary...")).toBeInTheDocument();
  });
});

/*
 * Note: Additional integration tests for async data fetching, user interactions,
 * and period switching would be better suited for E2E tests using Playwright or Cypress,
 * as they involve complex state management, async updates, and chart rendering that
 * are difficult to test reliably in a jsdom environment.
 *
 * The API route tests in route.test.ts provide comprehensive coverage of the backend logic,
 * including all period types (month/year/week), validation, and edge cases.
 */
