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

  it("should render all six navigation links", () => {
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/transactions");
    expect(screen.getByRole("link", { name: "Budgets" })).toHaveAttribute("href", "/budgets");
    expect(screen.getByRole("link", { name: "Fixed Costs" })).toHaveAttribute("href", "/fixed-costs");
    expect(screen.getByRole("link", { name: "Debts" })).toHaveAttribute("href", "/debts");
    expect(screen.getByRole("link", { name: "Savings" })).toHaveAttribute("href", "/savings");
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
});
