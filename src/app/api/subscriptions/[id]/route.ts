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

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: body,
    });

    return NextResponse.json(attachMonthlyEquivalent(subscription));
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
