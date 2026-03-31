import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  type TransactionCreateInput,
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

function buildTransactionCreateData(body: TransactionCreateInput) {
  const lineItems = body.lineItems ?? [{ amount: body.amount! }];

  return {
    categoryId: body.categoryId,
    amount: lineItems.reduce((sum, item) => sum + item.amount, 0),
    transactionDate: body.transactionDate,
    description: body.description,
    vendor: body.vendor,
    lineItems: {
      create: lineItems.map((item, index) => ({
        amount: item.amount,
        sortOrder: index,
      })),
    },
  };
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
        lineItems: {
          orderBy: {
            sortOrder: "asc",
          },
        },
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
      data: buildTransactionCreateData(body),
      include: {
        category: true,
        lineItems: {
          orderBy: {
            sortOrder: "asc",
          },
        },
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
