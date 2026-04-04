// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonthSelector } from "@/app/month-selector";

vi.mock("@/lib/months", () => ({
  shiftMonthValue: (month: string, delta: number) => {
    if (month === "2026-03" && delta === -1) {
      return "2026-02";
    }

    if (month === "2026-03" && delta === 1) {
      return "2026-04";
    }

    return month;
  },
}));

describe("[Component] month selector", () => {
  it("should call onChange with the previous month when Previous is clicked", () => {
    const onChange = vi.fn();

    render(<MonthSelector value="2026-03" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(onChange).toHaveBeenCalledWith("2026-02");
  });

  it("should call onChange with the next month when Next is clicked", () => {
    const onChange = vi.fn();

    render(<MonthSelector value="2026-03" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onChange).toHaveBeenCalledWith("2026-04");
  });

  it("should call onChange with the typed month when a month is selected", () => {
    const onChange = vi.fn();

    render(<MonthSelector value="2026-03" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Month"), {
      target: { value: "2026-05" },
    });

    expect(onChange).toHaveBeenCalledWith("2026-05");
  });

  it("should ignore empty month input values when the browser clears the control", () => {
    const onChange = vi.fn();

    render(<MonthSelector value="2026-03" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Month"), {
      target: { value: "" },
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
