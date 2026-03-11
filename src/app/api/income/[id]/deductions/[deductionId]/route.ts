import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { incomeDeductionUpdateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parsePositiveInt(value: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

type RouteContext = {
  params: Promise<{
    id: string;
    deductionId: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id, deductionId } = await context.params;
    const incomeSourceId = parsePositiveInt(id);
    const parsedDeductionId = parsePositiveInt(deductionId);

    if (!incomeSourceId) {
      return jsonError("Invalid income source id", 400);
    }

    if (!parsedDeductionId) {
      return jsonError("Invalid deduction id", 400);
    }

    const body = incomeDeductionUpdateSchema.parse(await request.json());

    const deduction = await prisma.incomeDeduction.findFirst({
      where: {
        id: parsedDeductionId,
        incomeSourceId,
      },
    });

    if (!deduction) {
      return jsonError("Deduction not found", 404);
    }

    const updatedDeduction = await prisma.incomeDeduction.update({
      where: { id: parsedDeductionId },
      data: body,
    });

    return NextResponse.json(updatedDeduction);
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
  const { id, deductionId } = await context.params;
  const incomeSourceId = parsePositiveInt(id);
  const parsedDeductionId = parsePositiveInt(deductionId);

  if (!incomeSourceId) {
    return jsonError("Invalid income source id", 400);
  }

  if (!parsedDeductionId) {
    return jsonError("Invalid deduction id", 400);
  }

  const deduction = await prisma.incomeDeduction.findFirst({
    where: {
      id: parsedDeductionId,
      incomeSourceId,
    },
  });

  if (!deduction) {
    return jsonError("Deduction not found", 404);
  }

  await prisma.incomeDeduction.delete({
    where: { id: parsedDeductionId },
  });

  return new NextResponse(null, { status: 204 });
}
