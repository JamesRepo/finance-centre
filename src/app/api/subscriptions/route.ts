import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { subscriptionCreateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

export async function GET() {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(subscriptions.map(attachMonthlyEquivalent));
}

export async function POST(request: NextRequest) {
  try {
    const body = subscriptionCreateSchema.parse(await request.json());

    const subscription = await prisma.subscription.create({
      data: body,
    });

    return NextResponse.json(attachMonthlyEquivalent(subscription), { status: 201 });
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
