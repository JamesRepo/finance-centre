import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { holidayExpenseUpdateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parsePositiveInt(value: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

type RouteContext = {
  params: Promise<{
    id: string;
    expenseId: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id, expenseId } = await context.params;
    const holidayId = parsePositiveInt(id);
    const parsedExpenseId = parsePositiveInt(expenseId);

    if (!holidayId) {
      return jsonError("Invalid holiday id", 400);
    }

    if (!parsedExpenseId) {
      return jsonError("Invalid expense id", 400);
    }

    const body = holidayExpenseUpdateSchema.parse(await request.json());

    const expense = await prisma.holidayExpense.findFirst({
      where: {
        id: parsedExpenseId,
        holidayId,
      },
    });

    if (!expense) {
      return jsonError("Expense not found", 404);
    }

    const updatedExpense = await prisma.holidayExpense.update({
      where: { id: parsedExpenseId },
      data: body,
    });

    return NextResponse.json(updatedExpense);
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
  const { id, expenseId } = await context.params;
  const holidayId = parsePositiveInt(id);
  const parsedExpenseId = parsePositiveInt(expenseId);

  if (!holidayId) {
    return jsonError("Invalid holiday id", 400);
  }

  if (!parsedExpenseId) {
    return jsonError("Invalid expense id", 400);
  }

  const expense = await prisma.holidayExpense.findFirst({
    where: {
      id: parsedExpenseId,
      holidayId,
    },
  });

  if (!expense) {
    return jsonError("Expense not found", 404);
  }

  await prisma.holidayExpense.delete({
    where: { id: parsedExpenseId },
  });

  return new NextResponse(null, { status: 204 });
}
