import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { subscriptionUpdateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseSubscriptionId(id: string) {
  const subscriptionId = Number(id);

  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    return null;
  }

  return subscriptionId;
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function getMonthStart(month: string) {
  return getMonthRange(month).gte;
}

function getMonthValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}`;
}

function isDateInMonth(date: Date, month: string) {
  const monthRange = getMonthRange(month);
  return date >= monthRange.gte && date < monthRange.lt;
}

function attachMonthlyEquivalent<T extends { amount: Prisma.Decimal; frequency: string }>(
  subscription: T,
) {
  return {
    ...subscription,
    monthlyEquivalent:
      subscription.frequency === "YEARLY"
        ? subscription.amount.div(new Prisma.Decimal(12))
        : subscription.amount,
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const subscriptionId = parseSubscriptionId(id);

    if (!subscriptionId) {
      return jsonError("Invalid subscription id", 400);
    }

    const body = subscriptionUpdateSchema.parse(await request.json());

    const existingSubscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!existingSubscription) {
      return jsonError("Subscription not found", 404);
    }

    const nextPaymentDate = body.paymentDate ?? existingSubscription.paymentDate;
    const nextMonth = body.month ?? getMonthValue(existingSubscription.paymentMonth);

    if (!isDateInMonth(nextPaymentDate, nextMonth)) {
      return jsonError("Payment date must be within the selected month", 400);
    }

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        name: body.name,
        amount: body.amount,
        frequency: body.frequency,
        paymentDate: body.paymentDate,
        paymentMonth: body.month ? getMonthStart(body.month) : undefined,
        description: body.description,
      },
    });

    return NextResponse.json(attachMonthlyEquivalent(subscription));
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
      return jsonError("Subscription already exists for this month", 409);
    }

    throw error;
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const subscriptionId = parseSubscriptionId(id);

  if (!subscriptionId) {
    return jsonError("Invalid subscription id", 400);
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!existingSubscription) {
    return jsonError("Subscription not found", 404);
  }

  await prisma.subscription.delete({
    where: { id: subscriptionId },
  });

  return new NextResponse(null, { status: 204 });
}
