import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { analysisQuerySchema } from "@/lib/validators";
import { getCurrentMonthValue, shiftMonthValue } from "@/lib/months";
import { ZodError } from "zod";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getMonthRange(month: string) {
  const [year, m] = month.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(year, m - 1, 1)),
    lt: new Date(Date.UTC(year, m, 1)),
  };
}

function zeroDecimal() {
  return new Prisma.Decimal(0);
}

function generateMonthRange(months: number): string[] {
  const current = getCurrentMonthValue();
  const result: string[] = [];

  for (let i = months - 1; i >= 0; i--) {
    result.push(shiftMonthValue(current, -i));
  }

  return result;
}

// --- Spending Section ---

async function getSpendingData(months: number) {
  const monthList = generateMonthRange(months);

  const monthlyTotals = await Promise.all(
    monthList.map(async (month) => {
      const range = getMonthRange(month);
      const result = await prisma.transaction.aggregate({
        where: { transactionDate: range },
        _sum: { amount: true },
      });

      return {
        month,
        total: result._sum.amount ?? zeroDecimal(),
      };
    }),
  );

  const categoryBreakdown = await Promise.all(
    monthList.map(async (month) => {
      const range = getMonthRange(month);
      const grouped = await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { transactionDate: range },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      });

      return { month, categories: grouped };
    }),
  );

  // Collect all category IDs across all months
  const allCategoryIds = new Set<string>();
  for (const entry of categoryBreakdown) {
    for (const cat of entry.categories) {
      allCategoryIds.add(cat.categoryId);
    }
  }

  const categories = allCategoryIds.size > 0
    ? await prisma.category.findMany({
        where: { id: { in: [...allCategoryIds] } },
      })
    : [];
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  // Determine top 5 categories by total across all months
  const categoryTotals = new Map<string, number>();
  for (const entry of categoryBreakdown) {
    for (const cat of entry.categories) {
      const current = categoryTotals.get(cat.categoryId) ?? 0;
      categoryTotals.set(
        cat.categoryId,
        current + Number(cat._sum.amount ?? 0),
      );
    }
  }

  const sortedCategories = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1]);
  const top5Ids = new Set(sortedCategories.slice(0, 5).map(([id]) => id));

  const stackedByMonth = monthList.map((month) => {
    const monthData = categoryBreakdown.find((e) => e.month === month);
    const result: Record<string, unknown> = { month };
    let otherTotal = 0;

    for (const cat of monthData?.categories ?? []) {
      const amount = Number(cat._sum.amount ?? 0);

      if (top5Ids.has(cat.categoryId)) {
        const catInfo = categoriesById.get(cat.categoryId);
        result[catInfo?.name ?? "Unknown"] = amount;
      } else {
        otherTotal += amount;
      }
    }

    if (otherTotal > 0) {
      result["Other"] = otherTotal;
    }

    return result;
  });

  const top5Categories = sortedCategories
    .slice(0, 5)
    .map(([id]) => {
      const cat = categoriesById.get(id);

      return {
        id,
        name: cat?.name ?? "Unknown",
        colorCode: cat?.colorCode ?? "#a8a29e",
      };
    });

  // If there are any "Other" categories, add it
  const hasOther = sortedCategories.length > 5;

  // Category changes (current month vs prior month)
  const currentMonth = monthList[monthList.length - 1];
  const priorMonth = monthList.length >= 2 ? monthList[monthList.length - 2] : null;

  const currentData = categoryBreakdown.find((e) => e.month === currentMonth);
  const priorData = priorMonth
    ? categoryBreakdown.find((e) => e.month === priorMonth)
    : null;

  const currentByCategory = new Map(
    (currentData?.categories ?? []).map((c) => [c.categoryId, Number(c._sum.amount ?? 0)]),
  );
  const priorByCategory = new Map(
    (priorData?.categories ?? []).map((c) => [c.categoryId, Number(c._sum.amount ?? 0)]),
  );

  const allChangeCategoryIds = new Set([
    ...currentByCategory.keys(),
    ...priorByCategory.keys(),
  ]);

  const categoryChanges = [...allChangeCategoryIds]
    .map((id) => {
      const current = currentByCategory.get(id) ?? 0;
      const prior = priorByCategory.get(id) ?? 0;
      const cat = categoriesById.get(id);

      return {
        categoryId: id,
        categoryName: cat?.name ?? "Unknown",
        colorCode: cat?.colorCode ?? "#a8a29e",
        currentTotal: current,
        priorTotal: prior,
        change: current - prior,
      };
    })
    .filter((c) => c.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);

  return {
    monthlyTotals,
    stackedByMonth,
    top5Categories,
    hasOther,
    categoryChanges,
  };
}

// --- Budget Section ---

async function getBudgetData(months: number) {
  const monthList = generateMonthRange(months);

  const budgetHealth = await Promise.all(
    monthList.map(async (month) => {
      const range = getMonthRange(month);

      const [spentResult, budgets] = await Promise.all([
        prisma.transaction.aggregate({
          where: { transactionDate: range },
          _sum: { amount: true },
        }),
        prisma.budget.findMany({
          where: { month: range.gte },
        }),
      ]);

      const totalSpent = Number(spentResult._sum.amount ?? 0);
      const totalBudgeted = budgets.reduce(
        (sum, b) => sum + Number(b.amount),
        0,
      );

      // Count categories over budget
      const spentByCategory = await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { transactionDate: range },
        _sum: { amount: true },
      });

      const budgetByCategory = new Map(
        budgets.map((b) => [b.categoryId, Number(b.amount)]),
      );

      let overBudgetCount = 0;
      for (const cat of spentByCategory) {
        const budgetAmount = budgetByCategory.get(cat.categoryId);
        if (budgetAmount !== undefined && Number(cat._sum.amount ?? 0) > budgetAmount) {
          overBudgetCount++;
        }
      }

      return {
        month,
        totalSpent,
        totalBudgeted,
        utilisation: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
        overBudgetCount,
      };
    }),
  );

  return { budgetHealth };
}

// --- Income Section ---

async function getIncomeData(months: number) {
  const monthList = generateMonthRange(months);

  const incomeVsOutgoings = await Promise.all(
    monthList.map(async (month) => {
      const range = getMonthRange(month);

      const [
        incomeResult,
        transactionResult,
        housingResult,
        subscriptionResult,
        debtPaymentResult,
        holidayExpenseResult,
      ] = await Promise.all([
        prisma.incomeSource.aggregate({
          where: { incomeDate: range },
          _sum: { netAmount: true },
        }),
        prisma.transaction.aggregate({
          where: { transactionDate: range },
          _sum: { amount: true },
        }),
        prisma.housingExpense.aggregate({
          where: { expenseMonth: range.gte },
          _sum: { amount: true },
        }),
        prisma.subscription.aggregate({
          where: { paymentMonth: range.gte },
          _sum: { amount: true },
        }),
        prisma.debtPayment.aggregate({
          where: { paymentDate: range },
          _sum: { amount: true },
        }),
        prisma.holidayExpense.aggregate({
          where: { expenseDate: range },
          _sum: { amount: true },
        }),
      ]);

      const income = Number(incomeResult._sum.netAmount ?? 0);
      const transactions = Number(transactionResult._sum.amount ?? 0);
      const housing = Number(housingResult._sum.amount ?? 0);
      const subscriptions = Number(subscriptionResult._sum.amount ?? 0);
      const debtPayments = Number(debtPaymentResult._sum.amount ?? 0);
      const holidayExpenses = Number(holidayExpenseResult._sum.amount ?? 0);

      const totalOutgoings =
        transactions + housing + subscriptions + debtPayments + holidayExpenses;

      return {
        month,
        income,
        outgoings: totalOutgoings,
        netPosition: income - totalOutgoings,
      };
    }),
  );

  // Deduction breakdown across the full date range
  const firstRange = getMonthRange(monthList[0]);
  const lastRange = getMonthRange(monthList[monthList.length - 1]);

  const deductionGroups = await prisma.incomeDeduction.groupBy({
    by: ["deductionType"],
    where: {
      incomeSource: {
        incomeDate: { gte: firstRange.gte, lt: lastRange.lt },
      },
    },
    _sum: { amount: true },
  });

  const deductionBreakdown = deductionGroups.map((g) => ({
    deductionType: g.deductionType,
    total: Number(g._sum.amount ?? 0),
  }));

  return { incomeVsOutgoings, deductionBreakdown };
}

// --- Net Worth Section ---

async function getNetWorthData(months: number) {
  const monthList = generateMonthRange(months);

  // Get all debts with their original balances
  const debts = await prisma.debt.findMany({
    select: { id: true, originalBalance: true },
  });
  const totalOriginalDebt = debts.reduce(
    (sum, d) => sum + Number(d.originalBalance),
    0,
  );

  const netWorthByMonth = await Promise.all(
    monthList.map(async (month) => {
      const range = getMonthRange(month);
      const endOfMonth = range.lt;

      // Cumulative debt payments (principal only) up to end of this month
      const debtPayments = await prisma.debtPayment.aggregate({
        where: { paymentDate: { lt: endOfMonth } },
        _sum: { amount: true, interestAmount: true },
      });

      const totalPaid = Number(debtPayments._sum.amount ?? 0);
      const totalInterest = Number(debtPayments._sum.interestAmount ?? 0);
      const principalPaid = totalPaid - totalInterest;
      const remainingDebt = Math.max(0, totalOriginalDebt - principalPaid);

      // Cumulative savings contributions up to end of this month
      const savingsResult = await prisma.savingsContribution.aggregate({
        where: { contributionDate: { lt: endOfMonth } },
        _sum: { amount: true },
      });

      const totalSavings = Number(savingsResult._sum.amount ?? 0);

      return {
        month,
        remainingDebt,
        totalSavings,
        netWorth: totalSavings - remainingDebt,
      };
    }),
  );

  return { netWorthByMonth };
}

export async function GET(request: NextRequest) {
  try {
    const query = analysisQuerySchema.parse({
      section: request.nextUrl.searchParams.get("section") ?? undefined,
      months: request.nextUrl.searchParams.get("months") ?? undefined,
    });

    switch (query.section) {
      case "spending":
        return NextResponse.json(await getSpendingData(query.months));
      case "budgets":
        return NextResponse.json(await getBudgetData(query.months));
      case "income":
        return NextResponse.json(await getIncomeData(query.months));
      case "networth":
        return NextResponse.json(await getNetWorthData(query.months));
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Invalid query parameters",
        400,
      );
    }

    throw error;
  }
}
