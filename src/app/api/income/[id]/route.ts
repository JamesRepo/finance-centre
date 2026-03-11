import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { incomeSourceUpdateWithDeductionsSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseIncomeSourceId(id: string) {
  const incomeSourceId = Number(id);

  if (!Number.isInteger(incomeSourceId) || incomeSourceId <= 0) {
    return null;
  }

  return incomeSourceId;
}

function attachTotalDeductions<T extends { incomeDeductions: Array<{ amount: Prisma.Decimal }> }>(
  incomeSource: T,
) {
  const totalDeductions = incomeSource.incomeDeductions.reduce(
    (sum, deduction) => sum.plus(deduction.amount),
    new Prisma.Decimal(0),
  );

  return {
    ...incomeSource,
    totalDeductions,
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const incomeSourceId = parseIncomeSourceId(id);

  if (!incomeSourceId) {
    return jsonError("Invalid income source id", 400);
  }

  const incomeSource = await prisma.incomeSource.findUnique({
    where: { id: incomeSourceId },
    include: {
      incomeDeductions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!incomeSource) {
    return jsonError("Income source not found", 404);
  }

  return NextResponse.json(attachTotalDeductions(incomeSource));
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const incomeSourceId = parseIncomeSourceId(id);

    if (!incomeSourceId) {
      return jsonError("Invalid income source id", 400);
    }

    const body = incomeSourceUpdateWithDeductionsSchema.parse(await request.json());
    const { deductions, ...incomeSourceData } = body;

    const existingIncomeSource = await prisma.incomeSource.findUnique({
      where: { id: incomeSourceId },
    });

    if (!existingIncomeSource) {
      return jsonError("Income source not found", 404);
    }

    const incomeSource = await prisma.$transaction(async (tx) => {
      if (Object.keys(incomeSourceData).length > 0) {
        await tx.incomeSource.update({
          where: { id: incomeSourceId },
          data: incomeSourceData,
        });
      }

      if (deductions !== undefined) {
        await tx.incomeDeduction.deleteMany({
          where: { incomeSourceId },
        });

        if (deductions.length > 0) {
          await tx.incomeDeduction.createMany({
            data: deductions.map((deduction) => ({
              incomeSourceId,
              ...deduction,
            })),
          });
        }
      }

      return tx.incomeSource.findUnique({
        where: { id: incomeSourceId },
        include: {
          incomeDeductions: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });
    });

    if (!incomeSource) {
      return jsonError("Income source not found", 404);
    }

    return NextResponse.json(attachTotalDeductions(incomeSource));
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
  const incomeSourceId = parseIncomeSourceId(id);

  if (!incomeSourceId) {
    return jsonError("Invalid income source id", 400);
  }

  const existingIncomeSource = await prisma.incomeSource.findUnique({
    where: { id: incomeSourceId },
  });

  if (!existingIncomeSource) {
    return jsonError("Income source not found", 404);
  }

  await prisma.incomeSource.delete({
    where: { id: incomeSourceId },
  });

  return new NextResponse(null, { status: 204 });
}
