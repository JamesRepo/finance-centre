import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  type TransactionLineItemInput,
  type TransactionUpdateInput,
  transactionUpdateSchema,
} from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function sumLineItems(lineItems: TransactionLineItemInput[]) {
  return lineItems.reduce((sum, item) => sum + item.amount, 0);
}

function buildTransactionUpdateData(body: TransactionUpdateInput) {
  const data: {
    amount?: number;
    categoryId?: string;
    transactionDate?: Date;
    description?: string;
    vendor?: string;
    lineItems?: {
      deleteMany: Record<string, never>;
      create: Array<{ amount: number; sortOrder: number }>;
    };
  } = {};

  if (body.categoryId !== undefined) {
    data.categoryId = body.categoryId;
  }

  if (body.transactionDate !== undefined) {
    data.transactionDate = body.transactionDate;
  }

  if (body.description !== undefined) {
    data.description = body.description;
  }

  if (body.vendor !== undefined) {
    data.vendor = body.vendor;
  }

  if (body.lineItems !== undefined) {
    data.amount = sumLineItems(body.lineItems);
    data.lineItems = {
      deleteMany: {},
      create: body.lineItems.map((item, index) => ({
        amount: item.amount,
        sortOrder: index,
      })),
    };
  } else if (body.amount !== undefined) {
    data.amount = body.amount;
    data.lineItems = {
      deleteMany: {},
      create: [
        {
          amount: body.amount,
          sortOrder: 0,
        },
      ],
    };
  }

  return data;
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = transactionUpdateSchema.parse(await request.json());

    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingTransaction) {
      return jsonError("Transaction not found", 404);
    }

    if (body.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: body.categoryId },
      });

      if (!category) {
        return jsonError("Category not found", 400);
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: buildTransactionUpdateData(body),
      include: {
        category: true,
        lineItems: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return NextResponse.json(transaction);
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

  const existingTransaction = await prisma.transaction.findUnique({
    where: { id },
  });

  if (!existingTransaction) {
    return jsonError("Transaction not found", 404);
  }

  await prisma.transaction.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
}
