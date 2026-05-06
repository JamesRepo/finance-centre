# Spending Streams

The app tracks spending across five independent streams. Each stream has its own data model and is aggregated separately before being combined into top-level totals. This means there is no need to duplicate entries between streams — for example, holiday costs do not need to be added as transactions.

## The Five Streams

| Stream | Source table | Managed at |
| --- | --- | --- |
| Daily spending | `Transaction` | `/transactions` |
| Housing | `HousingExpense` | `/housing` |
| Subscriptions | `Subscription` | `/subscriptions` |
| Holidays | `HolidayExpense` | `/holidays` |
| Debt payments | `DebtPayment` | `/debts` |

## Where Each Stream Appears

| Location | Transactions | Housing | Subscriptions | Holidays | Debt payments |
| --- | :---: | :---: | :---: | :---: | :---: |
| Dashboard total outgoings | Yes | Yes | Yes | Yes | Yes |
| Analysis: Income & Outgoings | Yes | Yes | Yes | Yes | Yes |
| Analysis: Spending Trends | Yes | No | No | No | No |
| Analysis: Budget Health | Yes | No | No | No | No |
| Transaction summary | Yes | No | No | No | No |

## How Holidays Are Attributed to a Month

Holiday costs reach the totals through two slightly different paths depending on the screen.

### Dashboard

Each holiday has an `assignedMonth` field (stored as `YYYY-MM`). When viewing a given month on the dashboard, the full cost of every holiday assigned to that month is included in outgoings. Holidays assigned to other months contribute zero.

### Analysis

The analysis Income & Outgoings section uses the `expenseDate` on each individual `HolidayExpense` record to determine which month it belongs to. This means expenses are distributed across months based on when they were actually incurred rather than which month the holiday is assigned to.

## Key Takeaway

Because holidays are a first-class spending stream, there is no need to create a "Holidays" category and add matching transactions. The dashboard and analysis pages already pull holiday expenses directly from the `HolidayExpense` table and include them in total outgoings automatically.
