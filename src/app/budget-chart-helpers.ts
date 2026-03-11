type BudgetChartEntryInput = {
  categoryId: string;
  amount: string;
  spent: string;
  category: {
    name: string;
    colorCode: string | null;
  };
};

export type BudgetChartEntry = {
  categoryId: string;
  name: string;
  budgetAmount: number;
  spentAmount: number;
  budgetBarAmount: number;
  spentFillRatio: number;
  isOverBudget: boolean;
  colorCode: string | null;
};

export function buildBudgetChartEntries(
  entries: BudgetChartEntryInput[],
): BudgetChartEntry[] {
  return entries.map((entry) => {
    const budgetAmount = Number(entry.amount);
    const spentAmount = Number(entry.spent);
    const isOverBudget =
      budgetAmount > 0 ? spentAmount > budgetAmount : spentAmount > 0;

    return {
      categoryId: entry.categoryId,
      name: entry.category.name,
      budgetAmount,
      spentAmount,
      budgetBarAmount: budgetAmount > 0 ? budgetAmount : Math.max(spentAmount, 1),
      spentFillRatio:
        budgetAmount > 0 ? Math.min(spentAmount / budgetAmount, 1) : spentAmount > 0 ? 1 : 0,
      isOverBudget,
      colorCode: entry.category.colorCode,
    };
  });
}
