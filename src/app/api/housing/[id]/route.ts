import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { housingExpenseRouteUpdateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseHousingExpenseId(id: string) {
  const housingExpenseId = Number(id);

  if (!Number.isInteger(housingExpenseId) || housingExpenseId <= 0) {
    return null;
  }

  return housingExpenseId;
}

function getMonthStart(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const housingExpenseId = parseHousingExpenseId(id);

    if (!housingExpenseId) {
      return jsonError("Invalid housing expense id", 400);
    }

    const body = housingExpenseRouteUpdateSchema.parse(await request.json());

    const existingExpense = await prisma.housingExpense.findUnique({
      where: { id: housingExpenseId },
    });

    if (!existingExpense) {
      return jsonError("Housing expense not found", 404);
    }

    const expenseType = body.expenseType ?? existingExpense.expenseType;
    const expenseMonth = body.month
      ? getMonthStart(body.month)
      : existingExpense.expenseMonth;

    const duplicateExpense = await prisma.housingExpense.findFirst({
      where: {
        expenseType,
        expenseMonth,
        id: {
          not: housingExpenseId,
        },
      },
    });

    if (duplicateExpense) {
      return jsonError("Housing expense already exists for this type and month", 409);
    }

    const housingExpense = await prisma.housingExpense.update({
      where: { id: housingExpenseId },
      data: {
        expenseType: body.expenseType,
        amount: body.amount,
        expenseMonth: body.month ? getMonthStart(body.month) : undefined,
        frequency: body.frequency,
      },
    });

    return NextResponse.json(housingExpense);
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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const housingExpenseId = parseHousingExpenseId(id);

  if (!housingExpenseId) {
    return jsonError("Invalid housing expense id", 400);
  }

  const existingExpense = await prisma.housingExpense.findUnique({
    where: { id: housingExpenseId },
  });

  if (!existingExpense) {
    return jsonError("Housing expense not found", 404);
  }

  await prisma.housingExpense.delete({
    where: { id: housingExpenseId },
  });

  return new NextResponse(null, { status: 204 });
}
