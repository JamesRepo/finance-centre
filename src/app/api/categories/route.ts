import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { categoryCreateSchema } from "@/lib/validators";
import { ZodError } from "zod";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          transactions: true,
          budgets: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json(
    categories.map((category) => ({
      id: category.id,
      name: category.name,
      colorCode: category.colorCode,
      isSystem: category.isSystem,
      createdAt: category.createdAt,
      transactionCount: category._count.transactions,
      budgetCount: category._count.budgets,
    })),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = categoryCreateSchema.parse(await request.json());

    const category = await prisma.category.create({
      data: {
        name: body.name,
        colorCode: body.colorCode ?? null,
      },
    });

    return NextResponse.json(
      {
        ...category,
        transactionCount: 0,
        budgetCount: 0,
      },
      { status: 201 },
    );
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
