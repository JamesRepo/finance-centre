import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  housingExpenseListQuerySchema,
  housingExpenseUpsertSchema,
} from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function getMonthStart(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

function getCurrentMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}`;
}

export async function GET(request: NextRequest) {
  try {
    const query = housingExpenseListQuerySchema.parse({
      month: request.nextUrl.searchParams.get("month") ?? undefined,
    });
    const month = query.month ?? getCurrentMonth();

    const housingExpenses = await prisma.housingExpense.findMany({
      where: {
        expenseMonth: getMonthRange(month),
      },
      orderBy: {
        expenseType: "asc",
      },
    });

    return NextResponse.json(housingExpenses);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters", 400);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = housingExpenseUpsertSchema.parse(await request.json());
    const expenseMonth = getMonthStart(body.month);

    const housingExpense = await prisma.housingExpense.upsert({
      where: {
        expenseType_expenseMonth: {
          expenseType: body.expenseType,
          expenseMonth,
        },
      },
      update: {
        amount: body.amount,
        frequency: body.frequency,
      },
      create: {
        expenseType: body.expenseType,
        amount: body.amount,
        expenseMonth,
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
