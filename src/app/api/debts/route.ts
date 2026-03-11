import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { debtCreateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function calculateDebtSummary<
  T extends {
    originalBalance: Prisma.Decimal;
    debtPayments: Array<{ amount: Prisma.Decimal; interestAmount: Prisma.Decimal }>;
  },
>(
  debt: T,
) {
  const totalPaid = debt.debtPayments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );
  const totalInterestPaid = debt.debtPayments.reduce(
    (sum, payment) => sum.plus(payment.interestAmount),
    new Prisma.Decimal(0),
  );
  const principalPaid = totalPaid.minus(totalInterestPaid);

  return {
    ...debt,
    totalPaid,
    totalInterestPaid,
    principalPaid,
    paymentCount: debt.debtPayments.length,
    currentBalance: debt.originalBalance.minus(principalPaid),
  };
}

export async function GET() {
  const debts = await prisma.debt.findMany({
    include: {
      debtPayments: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(debts.map(calculateDebtSummary));
}

export async function POST(request: NextRequest) {
  try {
    const body = debtCreateSchema.parse(await request.json());

    const debt = await prisma.debt.create({
      data: body,
      include: {
        debtPayments: true,
      },
    });

    return NextResponse.json(calculateDebtSummary(debt), { status: 201 });
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
