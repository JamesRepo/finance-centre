import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { holidayCreateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function attachHolidaySummary<
  T extends {
    id: number;
    name: string;
    destination: string;
    startDate: Date;
    endDate: Date;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    holidayExpenses: Array<{ expenseType: string; amount: Prisma.Decimal }>;
    _count: { holidayExpenses: number };
  },
>(holiday: T) {
  const totalCost = holiday.holidayExpenses.reduce(
    (sum, expense) => sum.plus(expense.amount),
    new Prisma.Decimal(0),
  );
  const expenseTypeTotals = new Map<string, Prisma.Decimal>();

  for (const expense of holiday.holidayExpenses) {
    const currentTotal =
      expenseTypeTotals.get(expense.expenseType) ?? new Prisma.Decimal(0);

    expenseTypeTotals.set(expense.expenseType, currentTotal.plus(expense.amount));
  }

  const { holidayExpenses: _holidayExpenses, _count, ...holidaySummary } = holiday;

  return {
    ...holidaySummary,
    totalCost,
    expenseCount: _count.holidayExpenses,
    expenseBreakdown: Array.from(expenseTypeTotals.entries())
      .map(([expenseType, totalCostForType]) => ({
        expenseType,
        totalCost: totalCostForType,
      }))
      .sort((left, right) => left.expenseType.localeCompare(right.expenseType)),
  };
}

export async function GET() {
  const holidays = await prisma.holiday.findMany({
    include: {
      holidayExpenses: {
        select: {
          expenseType: true,
          amount: true,
        },
      },
      _count: {
        select: {
          holidayExpenses: true,
        },
      },
    },
    orderBy: {
      startDate: "desc",
    },
  });

  return NextResponse.json(holidays.map(attachHolidaySummary));
}

export async function POST(request: NextRequest) {
  try {
    const body = holidayCreateSchema.parse(await request.json());

    const holiday = await prisma.holiday.create({
      data: body,
      include: {
        holidayExpenses: {
          select: {
            expenseType: true,
            amount: true,
          },
        },
        _count: {
          select: {
            holidayExpenses: true,
          },
        },
      },
    });

    return NextResponse.json(attachHolidaySummary(holiday), { status: 201 });
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
