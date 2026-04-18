// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HousingPage from "@/app/housing/page";

const { mockFixedCostsView } = vi.hoisted(() => ({
  mockFixedCostsView: vi.fn(({ section }: { section: string }) => (
    <div data-testid="fixed-costs-view">{section}</div>
  )),
}));

vi.mock("@/app/fixed-costs/fixed-costs-view", () => ({
  FixedCostsView: mockFixedCostsView,
}));

describe("[Component] housing page", () => {
  it("should render the fixed costs view with the housing section when the page loads", () => {
    render(<HousingPage />);

    expect(mockFixedCostsView).toHaveBeenCalledWith({ section: "housing" }, undefined);
    expect(screen.getByTestId("fixed-costs-view")).toHaveTextContent("housing");
  });
});
