import { describe, expect, it } from "vitest";
import { buildBudgetChartEntries } from "@/app/budget-chart-helpers";

describe("[Unit] budget chart helpers", () => {
  it("should keep the budget as the reference bar when spending is over budget", () => {
    const [entry] = buildBudgetChartEntries([
      {
        categoryId: "category-1",
        amount: "200",
        spent: "240",
        category: {
          name: "Transport",
          colorCode: "#3b82f6",
        },
      },
    ]);

    expect(entry.budgetBarAmount).toBe(200);
    expect(entry.spentFillRatio).toBe(1);
    expect(entry.isOverBudget).toBe(true);
  });

  it("should show a fully filled over-budget bar when there is spending against a zero budget", () => {
    const [entry] = buildBudgetChartEntries([
      {
        categoryId: "category-1",
        amount: "0",
        spent: "40",
        category: {
          name: "Transport",
          colorCode: "#3b82f6",
        },
      },
    ]);

    expect(entry.budgetBarAmount).toBe(40);
    expect(entry.spentFillRatio).toBe(1);
    expect(entry.isOverBudget).toBe(true);
  });
});
