import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { debtUpdateSchema } from "@/lib/validators";

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

function attachCurrentBalance<T extends { originalBalance: Prisma.Decimal; debtPayments: Array<{ amount: Prisma.Decimal }> }>(
  debt: T,
) {
  const totalPaid = debt.debtPayments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );

  return {
    ...debt,
    currentBalance: debt.originalBalance.minus(totalPaid),
  };
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
    include: {
      debtPayments: {
        orderBy: {
          paymentDate: "desc",
        },
      },
    },
  });

  if (!debt) {
    return jsonError("Debt not found", 404);
  }

  return NextResponse.json(attachCurrentBalance(debt));
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const debtId = parseDebtId(id);

    if (!debtId) {
      return jsonError("Invalid debt id", 400);
    }

    const body = debtUpdateSchema.parse(await request.json());

    const existingDebt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!existingDebt) {
      return jsonError("Debt not found", 404);
    }

    const debt = await prisma.debt.update({
      where: { id: debtId },
      data: body,
      include: {
        debtPayments: {
          orderBy: {
            paymentDate: "desc",
          },
        },
      },
    });

    return NextResponse.json(attachCurrentBalance(debt));
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
  const debtId = parseDebtId(id);

  if (!debtId) {
    return jsonError("Invalid debt id", 400);
  }

  const existingDebt = await prisma.debt.findUnique({
    where: { id: debtId },
  });

  if (!existingDebt) {
    return jsonError("Debt not found", 404);
  }

  await prisma.debt.delete({
    where: { id: debtId },
  });

  return new NextResponse(null, { status: 204 });
}
