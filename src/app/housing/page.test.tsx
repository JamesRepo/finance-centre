// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HousingPage from "@/app/housing/page";

const { mockHousingView } = vi.hoisted(() => ({
  mockHousingView: vi.fn(() => (
    <div data-testid="housing-view">housing</div>
  )),
}));

vi.mock("@/app/housing/housing-view", () => ({
  HousingView: mockHousingView,
}));

describe("[Component] housing page", () => {
  it("should render the housing view when the page loads", () => {
    render(<HousingPage />);

    expect(mockHousingView).toHaveBeenCalledWith({}, undefined);
    expect(screen.getByTestId("housing-view")).toHaveTextContent("housing");
  });
});
