import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  transactionCreateSchema,
  transactionListQuerySchema,
} from "@/lib/validators";

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const query = transactionListQuerySchema.parse({
      month: request.nextUrl.searchParams.get("month") ?? undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
    });

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(query.month
          ? { transactionDate: getMonthRange(query.month) }
          : undefined),
        ...(query.categoryId ? { categoryId: query.categoryId } : undefined),
      },
      include: {
        category: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters", 400);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = transactionCreateSchema.parse(await request.json());

    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
    });

    if (!category) {
      return jsonError("Category not found", 400);
    }

    const transaction = await prisma.transaction.create({
      data: body,
      include: {
        category: true,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
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
