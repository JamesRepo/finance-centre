import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { incomeDeductionCreateSchema } from "@/lib/validators";

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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const incomeSourceId = parseIncomeSourceId(id);

    if (!incomeSourceId) {
      return jsonError("Invalid income source id", 400);
    }

    const body = incomeDeductionCreateSchema.parse(await request.json());

    const incomeSource = await prisma.incomeSource.findUnique({
      where: { id: incomeSourceId },
    });

    if (!incomeSource) {
      return jsonError("Income source not found", 404);
    }

    const deduction = await prisma.incomeDeduction.create({
      data: {
        incomeSourceId,
        ...body,
      },
    });

    return NextResponse.json(deduction, { status: 201 });
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
