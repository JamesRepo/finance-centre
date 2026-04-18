// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SubscriptionsPage from "@/app/subscriptions/page";

const { mockFixedCostsView } = vi.hoisted(() => ({
  mockFixedCostsView: vi.fn(({ section }: { section: string }) => (
    <div data-testid="fixed-costs-view">{section}</div>
  )),
}));

vi.mock("@/app/fixed-costs/fixed-costs-view", () => ({
  FixedCostsView: mockFixedCostsView,
}));

describe("[Component] subscriptions page", () => {
  it("should render the fixed costs view with the subscriptions section when the page loads", () => {
    render(<SubscriptionsPage />);

    expect(mockFixedCostsView).toHaveBeenCalledWith(
      { section: "subscriptions" },
      undefined,
    );
    expect(screen.getByTestId("fixed-costs-view")).toHaveTextContent("subscriptions");
  });
});
