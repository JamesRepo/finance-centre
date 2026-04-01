// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signOut: mockSignOut,
}));

describe("[Component] NavBar", () => {
  beforeEach(() => {
    mockPathname = "/";
    vi.clearAllMocks();
  });

  it("should render all ten navigation links", () => {
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/transactions");
    expect(screen.getByRole("link", { name: "Summary" })).toHaveAttribute("href", "/transactions/summary");
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

  it("should include dark-mode classes for the active navigation state", () => {
    mockPathname = "/";
    render(<NavBar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).toContain("dark:border-stone-100");
    expect(dashboardLink.className).toContain("dark:text-stone-50");
  });

  it("should highlight the Transactions link when on /transactions", () => {
    mockPathname = "/transactions";
    render(<NavBar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).toContain("border-transparent");

    const transactionsLink = screen.getByRole("link", { name: "Transactions" });
    expect(transactionsLink.className).toContain("border-stone-950");

    const summaryLink = screen.getByRole("link", { name: "Summary" });
    expect(summaryLink.className).toContain("border-transparent");
  });

  it("should highlight both Transactions and Summary when on /transactions/summary", () => {
    mockPathname = "/transactions/summary";
    render(<NavBar />);

    const transactionsLink = screen.getByRole("link", { name: "Transactions" });
    const summaryLink = screen.getByRole("link", { name: "Summary" });

    expect(transactionsLink.className).toContain("border-stone-950");
    expect(summaryLink.className).toContain("border-stone-950");
  });

  it("should highlight both Transactions and Summary when on a nested summary route", () => {
    mockPathname = "/transactions/summary/details";
    render(<NavBar />);

    const transactionsLink = screen.getByRole("link", { name: "Transactions" });
    const summaryLink = screen.getByRole("link", { name: "Summary" });

    expect(transactionsLink.className).toContain("border-stone-950");
    expect(summaryLink.className).toContain("border-stone-950");
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
    const summaryIdx = labels.indexOf("Summary");
    const budgetsIdx = labels.indexOf("Budgets");

    expect(transactionsIdx).toBeLessThan(summaryIdx);
    expect(summaryIdx).toBeLessThan(budgetsIdx);
    expect(transactionsIdx).toBeLessThan(budgetsIdx);
  });

  it("should render Summary as an indented secondary navigation item", () => {
    render(<NavBar />);

    const summaryLink = screen.getByRole("link", { name: "Summary" });

    expect(summaryLink.className).toContain("ml-4");
    expect(summaryLink.className).toContain("self-start");
    expect(summaryLink.className).toContain("text-xs");
    expect(summaryLink.className).toContain("py-2");
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

describe("[Component] NavBar logout button", () => {
  beforeEach(() => {
    mockPathname = "/";
    vi.clearAllMocks();
  });

  it("should render a Logout button", () => {
    render(<NavBar />);
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("should call signOut with callbackUrl /login when Logout is clicked", async () => {
    const user = userEvent.setup();
    render(<NavBar />);

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("should call signOut exactly once per click", async () => {
    const user = userEvent.setup();
    render(<NavBar />);

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});

describe("[Component] NavBar login page visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render nothing when on /login", () => {
    mockPathname = "/login";
    const { container } = render(<NavBar />);
    expect(container.innerHTML).toBe("");
  });

  it("should not render navigation element when on /login", () => {
    mockPathname = "/login";
    render(<NavBar />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("should not render any links when on /login", () => {
    mockPathname = "/login";
    render(<NavBar />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("should not render the Logout button when on /login", () => {
    mockPathname = "/login";
    render(<NavBar />);
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("should render normally on non-login pages", () => {
    mockPathname = "/budgets";
    render(<NavBar />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });
});
