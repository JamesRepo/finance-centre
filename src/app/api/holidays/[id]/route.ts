import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { holidayCreateSchema, holidayUpdateSchema } from "@/lib/validators";

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

function attachHolidayDetails<
  T extends {
    holidayExpenses: Array<{ expenseType: string; amount: Prisma.Decimal }>;
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

    expenseTypeTotals.set(
      expense.expenseType,
      currentTotal.plus(expense.amount),
    );
  }

  return {
    ...holiday,
    totalCost,
    expenseBreakdown: Array.from(expenseTypeTotals.entries())
      .map(([expenseType, totalCostForType]) => ({
        expenseType,
        totalCost: totalCostForType,
      }))
      .sort((left, right) => left.expenseType.localeCompare(right.expenseType)),
  };
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
    include: {
      holidayExpenses: {
        orderBy: {
          expenseDate: "asc",
        },
      },
    },
  });

  if (!holiday) {
    return jsonError("Holiday not found", 404);
  }

  return NextResponse.json(attachHolidayDetails(holiday));
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const holidayId = parseHolidayId(id);

    if (!holidayId) {
      return jsonError("Invalid holiday id", 400);
    }

    const body = holidayUpdateSchema.parse(await request.json());

    const existingHoliday = await prisma.holiday.findUnique({
      where: { id: holidayId },
      include: {
        holidayExpenses: {
          orderBy: {
            expenseDate: "asc",
          },
        },
      },
    });

    if (!existingHoliday) {
      return jsonError("Holiday not found", 404);
    }

    holidayCreateSchema.parse({
      name: body.name ?? existingHoliday.name,
      destination: body.destination ?? existingHoliday.destination,
      startDate: body.startDate ?? existingHoliday.startDate,
      endDate: body.endDate ?? existingHoliday.endDate,
      description:
        body.description === undefined
          ? existingHoliday.description ?? undefined
          : body.description ?? undefined,
      isActive: body.isActive ?? existingHoliday.isActive,
    });

    const holiday = await prisma.holiday.update({
      where: { id: holidayId },
      data: body,
      include: {
        holidayExpenses: {
          orderBy: {
            expenseDate: "asc",
          },
        },
      },
    });

    return NextResponse.json(attachHolidayDetails(holiday));
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
  const holidayId = parseHolidayId(id);

  if (!holidayId) {
    return jsonError("Invalid holiday id", 400);
  }

  const existingHoliday = await prisma.holiday.findUnique({
    where: { id: holidayId },
  });

  if (!existingHoliday) {
    return jsonError("Holiday not found", 404);
  }

  await prisma.holiday.delete({
    where: { id: holidayId },
  });

  return new NextResponse(null, { status: 204 });
}
