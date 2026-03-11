import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { budgetListQuerySchema, budgetUpsertSchema } from "@/lib/validators";

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function getMonthStart(month: string) {
  return getMonthRange(month).gte;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const query = budgetListQuerySchema.parse({
      month: request.nextUrl.searchParams.get("month") ?? undefined,
    });

    const monthRange = getMonthRange(query.month);

    const [budgets, spending] = await Promise.all([
      prisma.budget.findMany({
        where: {
          month: monthRange,
        },
        include: {
          category: true,
        },
        orderBy: {
          category: {
            name: "asc",
          },
        },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          transactionDate: monthRange,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const spendingByCategoryId = new Map(
      spending.map((entry) => [entry.categoryId, entry._sum.amount]),
    );

    return NextResponse.json(
      budgets.map((budget) => ({
        ...budget,
        spent:
          spendingByCategoryId.get(budget.categoryId) ?? new Prisma.Decimal(0),
      })),
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters", 400);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = budgetUpsertSchema.parse(await request.json());
    const month = getMonthStart(body.month);

    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
    });

    if (!category) {
      return jsonError("Category not found", 400);
    }

    const existingBudget = await prisma.budget.findUnique({
      where: {
        categoryId_month: {
          categoryId: body.categoryId,
          month,
        },
      },
    });

    const budget = await prisma.budget.upsert({
      where: {
        categoryId_month: {
          categoryId: body.categoryId,
          month,
        },
      },
      update: {
        amount: body.amount,
      },
      create: {
        categoryId: body.categoryId,
        month,
        amount: body.amount,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(budget, { status: existingBudget ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid request body", 400);
    }

    if (error instanceof SyntaxError) {
      return jsonError("Invalid JSON body", 400);
    }

    throw error;
  }
}
