import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    paymentId: string;
  }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id, paymentId } = await context.params;
  const debtId = parsePositiveInt(id);
  const parsedPaymentId = parsePositiveInt(paymentId);

  if (!debtId) {
    return jsonError("Invalid debt id", 400);
  }

  if (!parsedPaymentId) {
    return jsonError("Invalid payment id", 400);
  }

  const payment = await prisma.debtPayment.findFirst({
    where: {
      id: parsedPaymentId,
      debtId,
    },
  });

  if (!payment) {
    return jsonError("Payment not found", 404);
  }

  await prisma.debtPayment.delete({
    where: { id: parsedPaymentId },
  });

  return new NextResponse(null, { status: 204 });
}
