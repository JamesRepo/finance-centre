import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { holidayExpenseCreateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseHolidayId(id: string) {
  const holidayId = Number(id);

  if (!Number.isInteger(holidayId) || holidayId <= 0) {
    return null;
  }

  return holidayId;
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const holidayId = parseHolidayId(id);

  if (!holidayId) {
    return jsonError("Invalid holiday id", 400);
  }

  const holiday = await prisma.holiday.findUnique({
    where: { id: holidayId },
  });

  if (!holiday) {
    return jsonError("Holiday not found", 404);
  }

  const expenses = await prisma.holidayExpense.findMany({
    where: { holidayId },
    orderBy: {
      expenseDate: "asc",
    },
  });

  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const holidayId = parseHolidayId(id);

    if (!holidayId) {
      return jsonError("Invalid holiday id", 400);
    }

    const body = holidayExpenseCreateSchema.parse(await request.json());

    const holiday = await prisma.holiday.findUnique({
      where: { id: holidayId },
    });

    if (!holiday) {
      return jsonError("Holiday not found", 404);
    }

    const expense = await prisma.holidayExpense.create({
      data: {
        holidayId,
        ...body,
      },
    });

    return NextResponse.json(expense, { status: 201 });
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
