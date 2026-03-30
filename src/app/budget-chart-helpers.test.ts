import { describe, expect, it } from "vitest";
import { buildBudgetChartEntries } from "@/app/budget-chart-helpers";

function makeEntry(overrides: { amount: string; spent: string }) {
  return {
    categoryId: "category-1",
    category: { name: "Transport", colorCode: "#3b82f6" },
    ...overrides,
  };
}

describe("[Unit] budget chart helpers", () => {
  it("should keep the budget as the reference bar when spending is over budget", () => {
    const [entry] = buildBudgetChartEntries([
      makeEntry({ amount: "200", spent: "240" }),
    ]);

    expect(entry.budgetBarAmount).toBe(200);
    expect(entry.spentFillRatio).toBe(1);
    expect(entry.isOverBudget).toBe(true);
  });

  it("should show a fully filled over-budget bar when there is spending against a zero budget", () => {
    const [entry] = buildBudgetChartEntries([
      makeEntry({ amount: "0", spent: "40" }),
    ]);

    expect(entry.budgetBarAmount).toBe(40);
    expect(entry.spentFillRatio).toBe(1);
    expect(entry.isOverBudget).toBe(true);
  });

  it("should produce zero budgetBarAmount when both budget and spending are zero", () => {
    const [entry] = buildBudgetChartEntries([
      makeEntry({ amount: "0", spent: "0" }),
    ]);

    expect(entry.budgetBarAmount).toBe(0);
    expect(entry.spentAmount).toBe(0);
    expect(entry.spentFillRatio).toBe(0);
    expect(entry.isOverBudget).toBe(false);
  });

  it("should show zero fill when there is a budget but no spending", () => {
    const [entry] = buildBudgetChartEntries([
      makeEntry({ amount: "500", spent: "0" }),
    ]);

    expect(entry.budgetBarAmount).toBe(500);
    expect(entry.spentAmount).toBe(0);
    expect(entry.spentFillRatio).toBe(0);
    expect(entry.isOverBudget).toBe(false);
  });

  it("should compute a partial fill ratio when spending is under budget", () => {
    const [entry] = buildBudgetChartEntries([
      makeEntry({ amount: "200", spent: "50" }),
    ]);

    expect(entry.budgetBarAmount).toBe(200);
    expect(entry.spentAmount).toBe(50);
    expect(entry.spentFillRatio).toBe(0.25);
    expect(entry.isOverBudget).toBe(false);
  });

  it("should floor budgetBarAmount to 1 when spending is below 1 and there is no budget", () => {
    const [entry] = buildBudgetChartEntries([
      makeEntry({ amount: "0", spent: "0.50" }),
    ]);

    expect(entry.budgetBarAmount).toBe(1);
    expect(entry.spentAmount).toBe(0.5);
    expect(entry.spentFillRatio).toBe(1);
    expect(entry.isOverBudget).toBe(true);
  });

  it("should return an empty array when given no entries", () => {
    const result = buildBudgetChartEntries([]);

    expect(result).toEqual([]);
  });

  it("should pass through categoryId, name, and colorCode from the input", () => {
    const [entry] = buildBudgetChartEntries([
      {
        categoryId: "cat-99",
        amount: "100",
        spent: "0",
        category: { name: "Groceries", colorCode: "#22c55e" },
      },
    ]);

    expect(entry.categoryId).toBe("cat-99");
    expect(entry.name).toBe("Groceries");
    expect(entry.colorCode).toBe("#22c55e");
  });

  it("should handle null colorCode", () => {
    const [entry] = buildBudgetChartEntries([
      {
        categoryId: "cat-1",
        amount: "100",
        spent: "0",
        category: { name: "Other", colorCode: null },
      },
    ]);

    expect(entry.colorCode).toBeNull();
  });
});
