import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
    },
    incomeSource: {
      aggregate: vi.fn(),
    },
    housingExpense: {
      aggregate: vi.fn(),
    },
    subscription: {
      aggregate: vi.fn(),
    },
    debtPayment: {
      aggregate: vi.fn(),
    },
    holidayExpense: {
      aggregate: vi.fn(),
    },
    debt: {
      findMany: vi.fn(),
    },
    savingsContribution: {
      aggregate: vi.fn(),
    },
    incomeDeduction: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/analysis/route";

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/analysis");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function zeroAggregate(fields: Record<string, boolean>) {
  const result: Record<string, null> = {};
  for (const key of Object.keys(fields)) {
    result[key] = null;
  }
  return { _sum: result };
}

describe("[Unit] analysis route GET", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T10:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Validation ---

  it("should return 400 when section is missing", async () => {
    const response = await GET(makeRequest({ months: "3" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("should return 400 when section is invalid", async () => {
    const response = await GET(makeRequest({ section: "invalid" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("should return 400 when months is not 3, 6, or 12", async () => {
    const response = await GET(
      makeRequest({ section: "spending", months: "5" }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("months must be 3, 6, or 12");
  });

  // --- Spending Section ---

  describe("spending section", () => {
    it("should return monthly totals for the requested number of months", async () => {
      // 3 months: Feb, Mar, Apr 2026
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("100.00") },
      });
      mockPrisma.transaction.groupBy.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const response = await GET(
        makeRequest({ section: "spending", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.monthlyTotals).toHaveLength(3);
      expect(body.monthlyTotals[0].month).toBe("2026-02");
      expect(body.monthlyTotals[2].month).toBe("2026-04");
    });

    it("should default to 6 months when months param is omitted", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      mockPrisma.transaction.groupBy.mockResolvedValue([]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const response = await GET(makeRequest({ section: "spending" }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.monthlyTotals).toHaveLength(6);
    });

    it("should return zero totals when there are no transactions", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const response = await GET(
        makeRequest({ section: "spending", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.monthlyTotals) {
        expect(entry.total).toBe("0");
      }
      expect(body.top5Categories).toHaveLength(0);
      expect(body.hasOther).toBe(false);
      expect(body.categoryChanges).toHaveLength(0);
    });

    it("should return top 5 categories and group the rest as Other", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("600.00") },
      });

      // Create 6 categories so one becomes "Other"
      const categories = Array.from({ length: 6 }, (_, i) => ({
        categoryId: `cat-${i + 1}`,
        _sum: { amount: new Prisma.Decimal(String((6 - i) * 100)) },
      }));
      mockPrisma.transaction.groupBy.mockResolvedValue(categories);
      mockPrisma.category.findMany.mockResolvedValue(
        categories.map((c) => ({
          id: c.categoryId,
          name: `Category ${c.categoryId.split("-")[1]}`,
          colorCode: `#${c.categoryId.split("-")[1].padStart(6, "0")}`,
        })),
      );

      const response = await GET(
        makeRequest({ section: "spending", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.top5Categories).toHaveLength(5);
      expect(body.hasOther).toBe(true);
    });

    it("should not set hasOther when there are 5 or fewer categories", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("300.00") },
      });
      mockPrisma.transaction.groupBy.mockResolvedValue([
        {
          categoryId: "cat-1",
          _sum: { amount: new Prisma.Decimal("200.00") },
        },
        {
          categoryId: "cat-2",
          _sum: { amount: new Prisma.Decimal("100.00") },
        },
      ]);
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-1", name: "Food", colorCode: "#FF0000" },
        { id: "cat-2", name: "Transport", colorCode: "#00FF00" },
      ]);

      const response = await GET(
        makeRequest({ section: "spending", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.hasOther).toBe(false);
      expect(body.top5Categories).toHaveLength(2);
    });

    it("should calculate category changes between current and prior month", async () => {
      // 3 months: Feb, Mar, Apr. We set up different values for Mar and Apr.
      const aggregateResults = [
        // Feb
        { _sum: { amount: new Prisma.Decimal("100.00") } },
        // Mar
        { _sum: { amount: new Prisma.Decimal("200.00") } },
        // Apr
        { _sum: { amount: new Prisma.Decimal("300.00") } },
      ];
      let aggCallIdx = 0;
      mockPrisma.transaction.aggregate.mockImplementation(() =>
        Promise.resolve(aggregateResults[aggCallIdx++ % aggregateResults.length]),
      );

      // Month groupBy: Mar has cat-1=100, Apr has cat-1=250
      const groupByResults = [
        // Feb
        [{ categoryId: "cat-1", _sum: { amount: new Prisma.Decimal("50.00") } }],
        // Mar
        [{ categoryId: "cat-1", _sum: { amount: new Prisma.Decimal("100.00") } }],
        // Apr
        [{ categoryId: "cat-1", _sum: { amount: new Prisma.Decimal("250.00") } }],
      ];
      let groupByCallIdx = 0;
      mockPrisma.transaction.groupBy.mockImplementation(() =>
        Promise.resolve(groupByResults[groupByCallIdx++ % groupByResults.length]),
      );

      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-1", name: "Food", colorCode: "#FF0000" },
      ]);

      const response = await GET(
        makeRequest({ section: "spending", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.categoryChanges.length).toBeGreaterThan(0);
      const foodChange = body.categoryChanges.find(
        (c: { categoryId: string }) => c.categoryId === "cat-1",
      );
      expect(foodChange).toBeDefined();
      expect(foodChange.change).toBe(150); // 250 - 100
    });

    it("should skip category lookups when no transactions exist across all months", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const response = await GET(
        makeRequest({ section: "spending", months: "3" }),
      );

      expect(response.status).toBe(200);
      expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    });
  });

  // --- Budget Section ---

  describe("budgets section", () => {
    it("should return budget utilisation for each month", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("800.00") },
      });
      mockPrisma.budget.findMany.mockResolvedValue([
        { categoryId: "cat-1", amount: new Prisma.Decimal("500.00") },
        { categoryId: "cat-2", amount: new Prisma.Decimal("500.00") },
      ]);
      mockPrisma.transaction.groupBy.mockResolvedValue([
        {
          categoryId: "cat-1",
          _sum: { amount: new Prisma.Decimal("600.00") },
        },
      ]);

      const response = await GET(
        makeRequest({ section: "budgets", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.budgetHealth).toHaveLength(3);
      for (const entry of body.budgetHealth) {
        expect(entry).toHaveProperty("month");
        expect(entry).toHaveProperty("totalSpent");
        expect(entry).toHaveProperty("totalBudgeted");
        expect(entry).toHaveProperty("utilisation");
        expect(entry).toHaveProperty("overBudgetCount");
      }
    });

    it("should calculate utilisation as zero when there are no budgets", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("100.00") },
      });
      mockPrisma.budget.findMany.mockResolvedValue([]);
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const response = await GET(
        makeRequest({ section: "budgets", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.budgetHealth) {
        expect(entry.utilisation).toBe(0);
        expect(entry.totalBudgeted).toBe(0);
      }
    });

    it("should count categories that exceed their budget", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("1200.00") },
      });
      mockPrisma.budget.findMany.mockResolvedValue([
        { categoryId: "cat-1", amount: new Prisma.Decimal("300.00") },
        { categoryId: "cat-2", amount: new Prisma.Decimal("500.00") },
      ]);
      // cat-1 is over budget (400 > 300), cat-2 is under (200 < 500)
      mockPrisma.transaction.groupBy.mockResolvedValue([
        {
          categoryId: "cat-1",
          _sum: { amount: new Prisma.Decimal("400.00") },
        },
        {
          categoryId: "cat-2",
          _sum: { amount: new Prisma.Decimal("200.00") },
        },
      ]);

      const response = await GET(
        makeRequest({ section: "budgets", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.budgetHealth) {
        expect(entry.overBudgetCount).toBe(1);
      }
    });

    it("should not count a category as over budget when spending equals budget", async () => {
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("300.00") },
      });
      mockPrisma.budget.findMany.mockResolvedValue([
        { categoryId: "cat-1", amount: new Prisma.Decimal("300.00") },
      ]);
      mockPrisma.transaction.groupBy.mockResolvedValue([
        {
          categoryId: "cat-1",
          _sum: { amount: new Prisma.Decimal("300.00") },
        },
      ]);

      const response = await GET(
        makeRequest({ section: "budgets", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.budgetHealth) {
        expect(entry.overBudgetCount).toBe(0);
      }
    });
  });

  // --- Income Section ---

  describe("income section", () => {
    function mockAllZeroOutgoings() {
      mockPrisma.incomeSource.aggregate.mockResolvedValue(
        zeroAggregate({ grossAmount: true, netAmount: true }),
      );
      mockPrisma.transaction.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.housingExpense.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.subscription.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.debtPayment.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.holidayExpense.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.incomeDeduction.groupBy.mockResolvedValue([]);
    }

    it("should return income vs outgoings for each month", async () => {
      mockPrisma.incomeSource.aggregate.mockResolvedValue({
        _sum: {
          grossAmount: new Prisma.Decimal("3700.00"),
          netAmount: new Prisma.Decimal("3000.00"),
        },
      });
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("500.00") },
      });
      mockPrisma.housingExpense.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("800.00") },
      });
      mockPrisma.subscription.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("50.00") },
      });
      mockPrisma.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("200.00") },
      });
      mockPrisma.holidayExpense.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("100.00") },
      });
      mockPrisma.incomeDeduction.groupBy.mockResolvedValue([]);

      const response = await GET(
        makeRequest({ section: "income", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.incomeVsOutgoings).toHaveLength(3);
      for (const entry of body.incomeVsOutgoings) {
        expect(entry.grossIncome).toBe(3700);
        expect(entry.income).toBe(3000);
        expect(entry.outgoings).toBe(1650); // 500 + 800 + 50 + 200 + 100
        expect(entry.netPosition).toBe(1350); // 3000 - 1650
      }
    });

    it("should return zeroes when no income or outgoings exist", async () => {
      mockAllZeroOutgoings();

      const response = await GET(
        makeRequest({ section: "income", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.incomeVsOutgoings) {
        expect(entry.grossIncome).toBe(0);
        expect(entry.income).toBe(0);
        expect(entry.outgoings).toBe(0);
        expect(entry.netPosition).toBe(0);
      }
    });

    it("should return a negative net position when outgoings exceed income", async () => {
      mockPrisma.incomeSource.aggregate.mockResolvedValue({
        _sum: {
          grossAmount: new Prisma.Decimal("900.00"),
          netAmount: new Prisma.Decimal("500.00"),
        },
      });
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("600.00") },
      });
      mockPrisma.housingExpense.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("200.00") },
      });
      mockPrisma.subscription.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.debtPayment.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.holidayExpense.aggregate.mockResolvedValue(
        zeroAggregate({ amount: true }),
      );
      mockPrisma.incomeDeduction.groupBy.mockResolvedValue([]);

      const response = await GET(
        makeRequest({ section: "income", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.incomeVsOutgoings) {
        expect(entry.netPosition).toBe(-300); // 500 - 800
      }
    });

    it("should aggregate all five outgoing sources", async () => {
      mockPrisma.incomeSource.aggregate.mockResolvedValue({
        _sum: {
          grossAmount: new Prisma.Decimal("6500.00"),
          netAmount: new Prisma.Decimal("5000.00"),
        },
      });
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("100.00") },
      });
      mockPrisma.housingExpense.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("200.00") },
      });
      mockPrisma.subscription.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("300.00") },
      });
      mockPrisma.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("400.00") },
      });
      mockPrisma.holidayExpense.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("500.00") },
      });
      mockPrisma.incomeDeduction.groupBy.mockResolvedValue([]);

      const response = await GET(
        makeRequest({ section: "income", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.incomeVsOutgoings) {
        expect(entry.outgoings).toBe(1500); // 100+200+300+400+500
      }
    });

    it("should return deduction breakdown grouped by type", async () => {
      mockAllZeroOutgoings();
      mockPrisma.incomeDeduction.groupBy.mockResolvedValue([
        {
          deductionType: "INCOME_TAX",
          _sum: { amount: new Prisma.Decimal("500.00") },
        },
        {
          deductionType: "NI",
          _sum: { amount: new Prisma.Decimal("200.00") },
        },
        {
          deductionType: "PENSION",
          _sum: { amount: new Prisma.Decimal("150.00") },
        },
      ]);

      const response = await GET(
        makeRequest({ section: "income", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.deductionBreakdown).toHaveLength(3);
      expect(body.deductionBreakdown).toEqual(
        expect.arrayContaining([
          { deductionType: "INCOME_TAX", total: 500 },
          { deductionType: "NI", total: 200 },
          { deductionType: "PENSION", total: 150 },
        ]),
      );
    });

    it("should return empty deduction breakdown when no deductions exist", async () => {
      mockAllZeroOutgoings();

      const response = await GET(
        makeRequest({ section: "income", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.deductionBreakdown).toEqual([]);
    });
  });

  // --- Net Worth Section ---

  describe("networth section", () => {
    it("should return remaining debt, savings, and net worth for each month", async () => {
      mockPrisma.debt.findMany.mockResolvedValue([
        { id: 1, originalBalance: new Prisma.Decimal("10000.00") },
      ]);
      mockPrisma.debtPayment.aggregate.mockResolvedValue({
        _sum: {
          amount: new Prisma.Decimal("3000.00"),
          interestAmount: new Prisma.Decimal("500.00"),
        },
      });
      mockPrisma.savingsContribution.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("2000.00") },
      });

      const response = await GET(
        makeRequest({ section: "networth", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.netWorthByMonth).toHaveLength(3);
      for (const entry of body.netWorthByMonth) {
        // remaining = 10000 - (3000 - 500) = 7500
        expect(entry.remainingDebt).toBe(7500);
        expect(entry.totalSavings).toBe(2000);
        // netWorth = 2000 - 7500 = -5500
        expect(entry.netWorth).toBe(-5500);
      }
    });

    it("should return zero remaining debt when all debt is paid off", async () => {
      mockPrisma.debt.findMany.mockResolvedValue([
        { id: 1, originalBalance: new Prisma.Decimal("1000.00") },
      ]);
      mockPrisma.debtPayment.aggregate.mockResolvedValue({
        _sum: {
          amount: new Prisma.Decimal("1500.00"),
          interestAmount: new Prisma.Decimal("200.00"),
        },
      });
      mockPrisma.savingsContribution.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("5000.00") },
      });

      const response = await GET(
        makeRequest({ section: "networth", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.netWorthByMonth) {
        // principal paid = 1500 - 200 = 1300, which exceeds 1000 debt
        expect(entry.remainingDebt).toBe(0);
        expect(entry.totalSavings).toBe(5000);
        expect(entry.netWorth).toBe(5000);
      }
    });

    it("should handle zero debt and zero savings", async () => {
      mockPrisma.debt.findMany.mockResolvedValue([]);
      mockPrisma.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: null, interestAmount: null },
      });
      mockPrisma.savingsContribution.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const response = await GET(
        makeRequest({ section: "networth", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.netWorthByMonth) {
        expect(entry.remainingDebt).toBe(0);
        expect(entry.totalSavings).toBe(0);
        expect(entry.netWorth).toBe(0);
      }
    });

    it("should aggregate multiple debts for total original balance", async () => {
      mockPrisma.debt.findMany.mockResolvedValue([
        { id: 1, originalBalance: new Prisma.Decimal("5000.00") },
        { id: 2, originalBalance: new Prisma.Decimal("3000.00") },
      ]);
      mockPrisma.debtPayment.aggregate.mockResolvedValue({
        _sum: {
          amount: new Prisma.Decimal("2000.00"),
          interestAmount: new Prisma.Decimal("0.00"),
        },
      });
      mockPrisma.savingsContribution.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal("1000.00") },
      });

      const response = await GET(
        makeRequest({ section: "networth", months: "3" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      for (const entry of body.netWorthByMonth) {
        // remaining = (5000 + 3000) - 2000 = 6000
        expect(entry.remainingDebt).toBe(6000);
        expect(entry.netWorth).toBe(1000 - 6000);
      }
    });
  });
});
