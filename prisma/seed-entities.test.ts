import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const seedSource = readFileSync(path.join(__dirname, "seed.ts"), "utf-8");

function extractConstLiteral<T>(source: string, constName: string): T {
  const match = source.match(
    new RegExp(`const ${constName}\\s*=\\s*([\\s\\S]*?)\\s+as const;`),
  );

  if (!match) {
    throw new Error(`Could not find const literal for ${constName}`);
  }

  return Function(`"use strict"; return (${match[1]});`)() as T;
}

const monthlyBudgets = extractConstLiteral<{
  current: Record<string, number>;
  previous: Record<string, number>;
}>(seedSource, "monthlyBudgets");

const sampleTransactions = extractConstLiteral<
  Array<{
    categoryName: string;
    daysAgo: number;
    description: string;
    vendor: string;
    lineItems: Array<{ amount: number }>;
  }>
>(seedSource, "sampleTransactions");

const sampleDebts = extractConstLiteral<
  Array<{
    name: string;
    debtType: string;
    originalBalance: number;
    interestRate: number;
    minimumPayment: number;
    startMonthOffset: number;
    targetPayoffMonthOffset: number;
    isActive: boolean;
    notes: string;
    payments: Array<{
      amount: number;
      interestAmount: number;
      monthOffset: number;
      day: number;
      note: string;
    }>;
  }>
>(seedSource, "sampleDebts");

const sampleSavingsGoals = extractConstLiteral<
  Array<{
    name: string;
    targetAmount: number;
    targetMonthOffset: number;
    priority: string;
    contributions: Array<{
      amount: number;
      monthOffset: number;
      day: number;
      note: string;
    }>;
  }>
>(seedSource, "sampleSavingsGoals");

const sampleHousingExpenses = extractConstLiteral<
  Array<{
    expenseType: string;
    amount: number;
    frequency: string;
    monthOffset: number;
  }>
>(seedSource, "sampleHousingExpenses");

const sampleSubscriptions = extractConstLiteral<
  Array<{
    name: string;
    amount: number;
    frequency: string;
    monthOffset: number;
    paymentDay: number;
    description: string;
  }>
>(seedSource, "sampleSubscriptions");

const sampleIncomeSources = extractConstLiteral<
  Array<{
    incomeType: string;
    description: string;
    grossAmount: number;
    netAmount: number;
    monthOffset: number;
    day: number;
    isRecurring: boolean;
    recurrenceFrequency: string;
    isActive: boolean;
    deductions: Array<{
      deductionType: string;
      name: string;
      amount: number;
      isPercentage?: boolean;
    }>;
  }>
>(seedSource, "sampleIncomeSources");

const sampleHolidays = extractConstLiteral<
  Array<{
    name: string;
    destination: string;
    assignedMonthOffset: number;
    startDay: number;
    endDay: number;
    description: string;
    expenses: Array<{
      expenseType: string;
      description: string;
      amount: number;
      day: number;
    }>;
  }>
>(seedSource, "sampleHolidays");

const seedSettings = extractConstLiteral<{
  currency: string;
  locale: string;
  monthlyBudgetTotal: number;
}>(seedSource, "seedSettings");

describe("[Unit] seed transaction fixtures", () => {
  it("should include line items for every sample transaction when transactions are seeded", () => {
    expect(sampleTransactions.length).toBeGreaterThan(0);

    for (const transaction of sampleTransactions) {
      expect(transaction.lineItems.length).toBeGreaterThan(0);
      expect(
        transaction.lineItems.every((lineItem) => lineItem.amount > 0),
        transaction.description,
      ).toBe(true);
    }
  });

  it("should include at least one split transaction when line-item support is seeded", () => {
    expect(sampleTransactions.some((transaction) => transaction.lineItems.length > 1)).toBe(true);
  });

  it("should keep seeded transaction descriptions tagged for cleanup when recreated", () => {
    expect(
      sampleTransactions.every((transaction) => transaction.description.startsWith("[Seed]")),
    ).toBe(true);
  });

  it("should keep seeded transaction dates within a realistic recent range when using daysAgo", () => {
    for (const transaction of sampleTransactions) {
      expect(transaction.daysAgo).toBeGreaterThanOrEqual(0);
      expect(transaction.daysAgo).toBeLessThan(90);
    }
  });
});

describe("[Unit] seed debt fixtures", () => {
  it("should define active debt records with valid payment metadata when debt data is seeded", () => {
    expect(sampleDebts).toHaveLength(2);

    for (const debt of sampleDebts) {
      expect(debt.name.startsWith("[Seed]")).toBe(true);
      expect(debt.isActive).toBe(true);
      expect(debt.originalBalance).toBeGreaterThan(0);
      expect(debt.minimumPayment).toBeGreaterThan(0);
      expect(debt.targetPayoffMonthOffset).toBeGreaterThan(debt.startMonthOffset);
      expect(debt.payments.length).toBeGreaterThan(0);
    }
  });

  it("should keep interest amounts below or equal to each debt payment amount when debt payments are seeded", () => {
    for (const debt of sampleDebts) {
      for (const payment of debt.payments) {
        expect(payment.amount).toBeGreaterThan(0);
        expect(payment.interestAmount).toBeGreaterThanOrEqual(0);
        expect(payment.interestAmount).toBeLessThanOrEqual(payment.amount);
        expect(payment.day).toBeGreaterThanOrEqual(1);
        expect(payment.day).toBeLessThanOrEqual(31);
      }
    }
  });

  it("should cover both current and previous month debt payments when dashboard summaries are seeded", () => {
    const paymentOffsets = sampleDebts.flatMap((debt) => debt.payments.map((payment) => payment.monthOffset));

    expect(paymentOffsets).toContain(0);
    expect(paymentOffsets).toContain(-1);
  });
});

describe("[Unit] seed savings fixtures", () => {
  it("should define savings goals with positive targets and contributions when savings data is seeded", () => {
    expect(sampleSavingsGoals).toHaveLength(2);

    for (const goal of sampleSavingsGoals) {
      expect(goal.name.startsWith("[Seed]")).toBe(true);
      expect(goal.targetAmount).toBeGreaterThan(0);
      expect(goal.targetMonthOffset).toBeGreaterThan(0);
      expect(goal.contributions.length).toBeGreaterThan(0);
      expect(goal.contributions.every((contribution) => contribution.amount > 0)).toBe(true);
    }
  });

  it("should include high and medium priority savings goals when multiple priorities are seeded", () => {
    const priorities = sampleSavingsGoals.map((goal) => goal.priority);

    expect(priorities).toContain("HIGH");
    expect(priorities).toContain("MEDIUM");
  });

  it("should include both current and prior month contributions when savings progress is seeded", () => {
    const contributionOffsets = sampleSavingsGoals.flatMap((goal) =>
      goal.contributions.map((contribution) => contribution.monthOffset),
    );

    expect(contributionOffsets).toContain(0);
    expect(contributionOffsets.some((offset) => offset < 0)).toBe(true);
  });
});

describe("[Unit] seed fixed-cost fixtures", () => {
  it("should define housing expenses across multiple expense types when fixed costs are seeded", () => {
    expect(sampleHousingExpenses.length).toBeGreaterThanOrEqual(4);
    expect(new Set(sampleHousingExpenses.map((expense) => expense.expenseType)).size).toBeGreaterThanOrEqual(4);
    expect(sampleHousingExpenses.every((expense) => expense.amount > 0)).toBe(true);
    expect(sampleHousingExpenses.every((expense) => expense.frequency === "MONTHLY")).toBe(true);
  });

  it("should include housing expenses for both the current and previous months when month-scoped fixed costs are seeded", () => {
    const monthOffsets = sampleHousingExpenses.map((expense) => expense.monthOffset);

    expect(monthOffsets).toContain(0);
    expect(monthOffsets).toContain(-1);
  });

  it("should define monthly and yearly subscriptions when subscription summaries are seeded", () => {
    const frequencies = sampleSubscriptions.map((subscription) => subscription.frequency);

    expect(frequencies).toContain("MONTHLY");
    expect(frequencies).toContain("YEARLY");
    expect(sampleSubscriptions.every((subscription) => subscription.name.startsWith("[Seed]"))).toBe(
      true,
    );
    expect(sampleSubscriptions.every((subscription) => subscription.paymentDay >= 1)).toBe(true);
    expect(sampleSubscriptions.every((subscription) => subscription.paymentDay <= 31)).toBe(true);
  });

  it("should include current and previous month subscriptions when month navigation is seeded", () => {
    const monthOffsets = sampleSubscriptions.map((subscription) => subscription.monthOffset);

    expect(monthOffsets).toContain(0);
    expect(monthOffsets).toContain(-1);
  });
});

describe("[Unit] seed income fixtures", () => {
  it("should define salary freelance and bonus income sources when income data is seeded", () => {
    const incomeTypes = sampleIncomeSources.map((incomeSource) => incomeSource.incomeType);

    expect(incomeTypes).toContain("SALARY");
    expect(incomeTypes).toContain("FREELANCE");
    expect(incomeTypes).toContain("BONUS");
  });

  it("should keep net pay less than or equal to gross pay for every seeded income source", () => {
    for (const incomeSource of sampleIncomeSources) {
      expect(incomeSource.grossAmount).toBeGreaterThan(0);
      expect(incomeSource.netAmount).toBeGreaterThan(0);
      expect(incomeSource.netAmount).toBeLessThanOrEqual(incomeSource.grossAmount);
      expect(incomeSource.description.startsWith("[Seed]")).toBe(true);
    }
  });

  it("should include deductions only where appropriate when income sources are seeded", () => {
    const sourceWithDeductions = sampleIncomeSources.filter(
      (incomeSource) => incomeSource.deductions.length > 0,
    );
    const sourceWithoutDeductions = sampleIncomeSources.filter(
      (incomeSource) => incomeSource.deductions.length === 0,
    );

    expect(sourceWithDeductions.length).toBeGreaterThan(0);
    expect(sourceWithoutDeductions.length).toBeGreaterThan(0);

    for (const incomeSource of sourceWithDeductions) {
      for (const deduction of incomeSource.deductions) {
        expect(deduction.name.startsWith("[Seed]")).toBe(true);
        expect(deduction.amount).toBeGreaterThan(0);
      }
    }
  });

  it("should cover recurring and one-off income when the dashboard summary seed is defined", () => {
    expect(sampleIncomeSources.some((incomeSource) => incomeSource.isRecurring)).toBe(true);
    expect(sampleIncomeSources.some((incomeSource) => !incomeSource.isRecurring)).toBe(true);
    expect(sampleIncomeSources.some((incomeSource) => incomeSource.recurrenceFrequency === "MONTHLY")).toBe(
      true,
    );
    expect(sampleIncomeSources.some((incomeSource) => incomeSource.recurrenceFrequency === "ONE_OFF")).toBe(
      true,
    );
  });
});

describe("[Unit] seed holiday and settings fixtures", () => {
  it("should define holidays with valid day ranges and positive expenses when holiday seed data is present", () => {
    expect(sampleHolidays.length).toBeGreaterThan(0);

    for (const holiday of sampleHolidays) {
      expect(holiday.name.startsWith("[Seed]")).toBe(true);
      expect(holiday.startDay).toBeLessThanOrEqual(holiday.endDay);
      expect(holiday.expenses.length).toBeGreaterThan(0);
      expect(holiday.expenses.every((expense) => expense.amount > 0)).toBe(true);
      expect(holiday.expenses.every((expense) => expense.description.startsWith("[Seed]"))).toBe(true);
    }
  });

  it("should define settings defaults for the seeded environment when settings are written", () => {
    expect(seedSettings).toEqual({
      currency: "GBP",
      locale: "en-GB",
      monthlyBudgetTotal: 1390,
    });
  });
});

describe("[Unit] seed script idempotency and coverage", () => {
  it("should delete tagged seed records for recreated entities when the seed reruns", () => {
    expect(seedSource).toContain("prisma.transaction.deleteMany");
    expect(seedSource).toContain("prisma.holiday.deleteMany");
    expect(seedSource).toContain("prisma.debt.deleteMany");
    expect(seedSource).toContain("prisma.savingsGoal.deleteMany");
    expect(seedSource).toContain("prisma.incomeSource.deleteMany");
    expect(seedSource).toContain("prisma.subscription.deleteMany");
  });

  it("should use upsert or create-only flows for entities with stable unique keys when the seed reruns", () => {
    expect(seedSource).toContain("prisma.category.upsert");
    expect(seedSource).toContain("prisma.budget.upsert");
    expect(seedSource).toContain("prisma.housingExpense.upsert");
    expect(seedSource).toContain("prisma.subscription.upsert");
    expect(seedSource).toContain("prisma.settings.create");
  });

  it("should preserve an existing settings row when the seed reruns on a populated database", () => {
    expect(seedSource).toContain("const existingSettings = await prisma.settings.findFirst");
    expect(seedSource).toContain("if (!existingSettings)");
    expect(seedSource).not.toContain("prisma.settings.update");
  });

  it("should keep seeded budgets aligned across current and previous month categories when budget fixtures are defined", () => {
    expect(Object.keys(monthlyBudgets.current)).toEqual(Object.keys(monthlyBudgets.previous));
    expect(Object.keys(monthlyBudgets.current)).toHaveLength(9);
  });

  it("should include every newly-seeded entity in the final console summary when the seed completes", () => {
    expect(seedSource).toContain("${sampleDebts.length} debts");
    expect(seedSource).toMatch(/\$\{\s*sampleSavingsGoals\.length\s*\}\s+savings goals/);
    expect(seedSource).toMatch(/\$\{\s*sampleHousingExpenses\.length\s*\}\s+housing expenses/);
    expect(seedSource).toMatch(/\$\{\s*sampleSubscriptions\.length\s*\}\s+subscriptions/);
    expect(seedSource).toMatch(/\$\{\s*sampleIncomeSources\.length\s*\}\s+income sources/);
    expect(seedSource).toMatch(/\$\{\s*sampleHolidays\.length\s*\}\s+holidays, and settings/);
  });
});
