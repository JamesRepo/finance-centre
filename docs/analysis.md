# Analysis Guide

The analysis feature provides longer-range views that complement the dashboard and transaction summary pages.

## UI Surface

The feature lives at `/analysis` and exposes four sections:

- `spending` shown as "Spending Trends"
- `budgets` shown as "Budget Health"
- `income` shown as "Income & Outgoings"
- `networth` shown as "Net Worth"

The page supports three time windows: `3`, `6`, or `12` months.

## API Contract

The page loads data from `GET /api/analysis`.

Query parameters:

- `section`: one of `spending`, `budgets`, `income`, or `networth`
- `months`: one of `3`, `6`, or `12`

Validation is enforced by `analysisQuerySchema` in `src/lib/validators.ts`. Invalid values return `400`.

## Section Definitions

### Spending

Data sources:

- `Transaction`
- `Category`

Returned shape:

- `monthlyTotals`: total transaction spend per month
- `stackedByMonth`: stacked totals for the top five categories, with the remainder grouped into `Other`
- `top5Categories`: names and colors used by the stacked chart
- `hasOther`: whether an `Other` segment exists
- `categoryChanges`: largest month-over-month category changes between the current month and the prior month

### Budget Health

Data sources:

- `Budget`
- `Transaction`

Returned shape:

- `budgetHealth`: per-month totals for `totalSpent`, `totalBudgeted`, `utilisation`, and `overBudgetCount`

Notes:

- `utilisation` is `totalSpent / totalBudgeted * 100`
- `overBudgetCount` only counts categories that have a budget for that month

### Income & Outgoings

Data sources:

- `IncomeSource`
- `IncomeDeduction`
- `Transaction`
- `HousingExpense`
- `Subscription`
- `DebtPayment`
- `HolidayExpense`

Returned shape:

- `incomeVsOutgoings`: monthly gross income, net income, outgoings, and net position
- `deductionBreakdown`: grouped totals by `deductionType` across the selected date range

Notes:

- Gross income uses `IncomeSource.grossAmount`
- Income uses `IncomeSource.netAmount`
- Outgoings include transaction spend, housing, subscriptions, debt payments, and holiday expenses

### Net Worth

Data sources:

- `Debt`
- `DebtPayment`
- `SavingsContribution`

Returned shape:

- `netWorthByMonth`: monthly `remainingDebt`, `totalSavings`, and `netWorth`

Notes:

- Remaining debt starts from the sum of `Debt.originalBalance`
- Only principal paid reduces debt; `interestAmount` is excluded from debt reduction
- Savings are cumulative contributions up to the end of each month
- Net worth is `totalSavings - remainingDebt`

## Relationship to Other Screens

- The dashboard is current-month oriented and operational.
- `/transactions/summary` focuses on spending breakdowns for a selected period.
- `/analysis` is trend-oriented and spans multiple months.

When changing calculations in one of these areas, check whether the others need to stay aligned or intentionally diverge.
