import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { debtPaymentCreateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseDebtId(id: string) {
  const debtId = Number(id);

  if (!Number.isInteger(debtId) || debtId <= 0) {
    return null;
  }

  return debtId;
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const debtId = parseDebtId(id);

  if (!debtId) {
    return jsonError("Invalid debt id", 400);
  }

  const debt = await prisma.debt.findUnique({
    where: { id: debtId },
  });

  if (!debt) {
    return jsonError("Debt not found", 404);
  }

  const payments = await prisma.debtPayment.findMany({
    where: { debtId },
    orderBy: {
      paymentDate: "desc",
    },
  });

  return NextResponse.json(payments);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const debtId = parseDebtId(id);

    if (!debtId) {
      return jsonError("Invalid debt id", 400);
    }

    const body = debtPaymentCreateSchema.parse(await request.json());

    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      return jsonError("Debt not found", 404);
    }

    const payment = await prisma.debtPayment.create({
      data: {
        debtId,
        ...body,
      },
    });

    return NextResponse.json(payment, { status: 201 });
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
