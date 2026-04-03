-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "show_on_dashboard_daily_spending" BOOLEAN NOT NULL DEFAULT false;

UPDATE "categories"
SET "show_on_dashboard_daily_spending" = true
WHERE "name" IN (
  'Groceries',
  'Eating Out',
  'Transport',
  'Entertainment',
  'Shopping',
  'Health',
  'Personal Care',
  'Education',
  'Gifts',
  'General'
);
