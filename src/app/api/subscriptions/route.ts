import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  subscriptionCreateSchema,
  subscriptionListQuerySchema,
} from "@/lib/validators";

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

function getCurrentMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");

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

export async function GET(request: NextRequest) {
  try {
    const query = subscriptionListQuerySchema.parse({
      month: request.nextUrl.searchParams.get("month") ?? undefined,
    });
    const month = query.month ?? getCurrentMonth();

    const subscriptions = await prisma.subscription.findMany({
      where: {
        paymentMonth: getMonthRange(month),
      },
      orderBy: [{ paymentDate: "asc" }, { name: "asc" }],
    });

    const subscriptionsWithEquivalent = subscriptions.map(attachMonthlyEquivalent);
    const total = subscriptions.reduce(
      (sum, subscription) => sum.add(subscription.amount),
      new Prisma.Decimal(0),
    );
    const monthlyEquivalentTotal = subscriptionsWithEquivalent.reduce(
      (sum, subscription) => sum.add(subscription.monthlyEquivalent),
      new Prisma.Decimal(0),
    );

    return NextResponse.json({
      month,
      subscriptions: subscriptionsWithEquivalent,
      total,
      monthlyEquivalentTotal,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters", 400);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = subscriptionCreateSchema.parse(await request.json());

    if (!isDateInMonth(body.paymentDate, body.month)) {
      return jsonError("Payment date must be within the selected month", 400);
    }

    const subscription = await prisma.subscription.create({
      data: {
        name: body.name,
        amount: body.amount,
        frequency: body.frequency,
        paymentDate: body.paymentDate,
        paymentMonth: getMonthStart(body.month),
        description: body.description,
      },
    });

    return NextResponse.json(attachMonthlyEquivalent(subscription), { status: 201 });
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
