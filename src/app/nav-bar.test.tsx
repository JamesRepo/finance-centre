// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavBar } from "@/app/nav-bar";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
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

describe("[Component] NavBar", () => {
  beforeEach(() => {
    mockPathname = "/";
  });

  it("should render all nine navigation links", () => {
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/transactions");
    expect(screen.getByRole("link", { name: "Budgets" })).toHaveAttribute("href", "/budgets");
    expect(screen.getByRole("link", { name: "Debts" })).toHaveAttribute("href", "/debts");
    expect(screen.getByRole("link", { name: "Savings" })).toHaveAttribute("href", "/savings");
    expect(screen.getByRole("link", { name: "Fixed Costs" })).toHaveAttribute("href", "/fixed-costs");
    expect(screen.getByRole("link", { name: "Income" })).toHaveAttribute("href", "/income");
    expect(screen.getByRole("link", { name: "Holidays" })).toHaveAttribute("href", "/holidays");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("should group links with visual separators between groups", () => {
    const { container } = render(<NavBar />);

    // There should be separator spans between Dashboard, each group, and Settings
    // Dashboard | Spending group | Tracking group | Fixed group | Travel group | Settings
    // = 5 separators (after Dashboard, between 4 groups = 3, before Settings)
    // However, the first group separator is after Dashboard (1), then between groups (3), then before Settings (1) = 5
    // But the group separators between groups are only rendered when groupIndex > 0 (3 of them)
    // Plus the fixed separator after Dashboard (1) and before Settings (1) = 5 total
    const separators = container.querySelectorAll("span.bg-stone-200");
    expect(separators.length).toBe(5);
  });

  it("should highlight the Dashboard link when on the root path", () => {
    mockPathname = "/";
    render(<NavBar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).toContain("border-stone-950");

    const transactionsLink = screen.getByRole("link", { name: "Transactions" });
    expect(transactionsLink.className).toContain("border-transparent");
  });

  it("should highlight the Transactions link when on /transactions", () => {
    mockPathname = "/transactions";
    render(<NavBar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).toContain("border-transparent");

    const transactionsLink = screen.getByRole("link", { name: "Transactions" });
    expect(transactionsLink.className).toContain("border-stone-950");
  });

  it("should highlight the Income link when on /income", () => {
    mockPathname = "/income";
    render(<NavBar />);

    const incomeLink = screen.getByRole("link", { name: "Income" });
    expect(incomeLink.className).toContain("border-stone-950");
  });

  it("should highlight the Debts link when on a sub-path like /debts/123", () => {
    mockPathname = "/debts/123";
    render(<NavBar />);

    const debtsLink = screen.getByRole("link", { name: "Debts" });
    expect(debtsLink.className).toContain("border-stone-950");
  });

  it("should highlight the Fixed Costs link when on /fixed-costs", () => {
    mockPathname = "/fixed-costs";
    render(<NavBar />);

    const fixedCostsLink = screen.getByRole("link", { name: "Fixed Costs" });
    expect(fixedCostsLink.className).toContain("border-stone-950");
  });

  it("should highlight the Holidays link when on /holidays", () => {
    mockPathname = "/holidays";
    render(<NavBar />);

    const holidaysLink = screen.getByRole("link", { name: "Holidays" });
    expect(holidaysLink.className).toContain("border-stone-950");
  });

  it("should highlight the Settings link when on /settings", () => {
    mockPathname = "/settings";
    render(<NavBar />);

    const settingsLink = screen.getByRole("link", { name: "Settings" });
    expect(settingsLink.className).toContain("border-stone-950");

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).toContain("border-transparent");
  });

  it("should not highlight Dashboard when on a non-root path", () => {
    mockPathname = "/savings";
    render(<NavBar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).toContain("border-transparent");

    const savingsLink = screen.getByRole("link", { name: "Savings" });
    expect(savingsLink.className).toContain("border-stone-950");
  });

  it("should render inside a nav element", () => {
    render(<NavBar />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("should render Spending group links in correct order", () => {
    render(<NavBar />);

    const links = screen.getAllByRole("link");
    const labels = links.map((link) => link.textContent);

    const transactionsIdx = labels.indexOf("Transactions");
    const budgetsIdx = labels.indexOf("Budgets");

    expect(transactionsIdx).toBeLessThan(budgetsIdx);
  });

  it("should render Tracking group links in correct order", () => {
    render(<NavBar />);

    const links = screen.getAllByRole("link");
    const labels = links.map((link) => link.textContent);

    const debtsIdx = labels.indexOf("Debts");
    const savingsIdx = labels.indexOf("Savings");

    expect(debtsIdx).toBeLessThan(savingsIdx);
  });

  it("should render Settings as the last link", () => {
    render(<NavBar />);

    const links = screen.getAllByRole("link");
    const lastLink = links[links.length - 1];

    expect(lastLink).toHaveTextContent("Settings");
    expect(lastLink).toHaveAttribute("href", "/settings");
  });
});
