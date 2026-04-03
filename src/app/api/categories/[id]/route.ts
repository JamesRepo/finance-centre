import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { categoryUpdateSchema } from "@/lib/validators";
import { ZodError } from "zod";

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
    const body = categoryUpdateSchema.parse(await request.json());

    const existingCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
            budgets: true,
          },
        },
      },
    });

    if (!existingCategory) {
      return jsonError("Category not found", 404);
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.colorCode !== undefined ? { colorCode: body.colorCode } : {}),
        ...(body.showOnDashboardDailySpending !== undefined
          ? {
              showOnDashboardDailySpending: body.showOnDashboardDailySpending,
            }
          : {}),
      },
    });

    return NextResponse.json({
      ...category,
      transactionCount: existingCategory._count.transactions,
      budgetCount: existingCategory._count.budgets,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid request body", 400);
    }

    if (error instanceof SyntaxError) {
      return jsonError("Invalid JSON body", 400);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError("A category with this name already exists", 409);
    }

    throw error;
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const existingCategory = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          transactions: true,
          budgets: true,
        },
      },
    },
  });

  if (!existingCategory) {
    return jsonError("Category not found", 404);
  }

  if (existingCategory._count.transactions > 0) {
    return jsonError(
      "Cannot delete a category that is used by transactions",
      409,
    );
  }

  if (existingCategory._count.budgets > 0) {
    return jsonError(
      "Cannot delete a category that is used by budgets",
      409,
    );
  }

  await prisma.category.delete({
    where: { id },
  });

  return new NextResponse(null, { status: 204 });
}
