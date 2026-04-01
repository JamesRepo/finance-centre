import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { subscriptionCopySchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

function getPaymentDateForTargetMonth(paymentDate: Date, targetMonth: string) {
  const [year, monthNumber] = targetMonth.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dayOfMonth = Math.min(paymentDate.getUTCDate(), lastDayOfMonth);

  return new Date(Date.UTC(year, monthNumber - 1, dayOfMonth));
}

export async function POST(request: NextRequest) {
  try {
    const body = subscriptionCopySchema.parse(await request.json());

    const sourceMonthRange = getMonthRange(body.sourceMonth);
    const targetMonthRange = getMonthRange(body.targetMonth);

    const [sourceSubscriptions, targetSubscriptions] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          paymentMonth: sourceMonthRange,
        },
        orderBy: [{ paymentDate: "asc" }, { name: "asc" }],
      }),
      prisma.subscription.findMany({
        where: {
          paymentMonth: targetMonthRange,
        },
        select: {
          name: true,
        },
      }),
    ]);

    const existingNames = new Set(targetSubscriptions.map((subscription) => subscription.name));
    const subscriptionsToCreate = sourceSubscriptions
      .filter((subscription) => !existingNames.has(subscription.name))
      .map((subscription) => ({
        name: subscription.name,
        amount: subscription.amount,
        frequency: subscription.frequency,
        paymentDate: getPaymentDateForTargetMonth(
          subscription.paymentDate,
          body.targetMonth,
        ),
        paymentMonth: getMonthStart(body.targetMonth),
        description: subscription.description,
      }));

    if (subscriptionsToCreate.length > 0) {
      await prisma.subscription.createMany({
        data: subscriptionsToCreate,
      });
    }

    return NextResponse.json({
      copiedCount: subscriptionsToCreate.length,
      skippedCount: sourceSubscriptions.length - subscriptionsToCreate.length,
    });
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
