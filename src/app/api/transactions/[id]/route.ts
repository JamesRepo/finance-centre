import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { transactionUpdateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
      data: body,
      include: {
        category: true,
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
