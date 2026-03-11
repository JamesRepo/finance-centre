import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatMonthLabel,
  getCurrentMonthValue,
  shiftMonthValue,
} from "@/lib/months";

describe("[Unit] month helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("should return the current month value when reading today's month", () => {
    vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

    expect(getCurrentMonthValue()).toBe("2026-03");
  });

  it("should format a month value as a readable label when a valid month is provided", () => {
    expect(formatMonthLabel("2026-03")).toBe("March 2026");
  });

  it("should shift across year boundaries when moving to a previous month", () => {
    expect(shiftMonthValue("2026-01", -1)).toBe("2025-12");
  });

  it("should shift across year boundaries when moving to a future month", () => {
    expect(shiftMonthValue("2026-12", 1)).toBe("2027-01");
  });
});
