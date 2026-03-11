import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { savingsGoalUpdateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseGoalId(id: string) {
  const goalId = Number(id);

  if (!Number.isInteger(goalId) || goalId <= 0) {
    return null;
  }

  return goalId;
}

function attachSavingsProgress<T extends { targetAmount: Prisma.Decimal; savingsContributions: Array<{ amount: Prisma.Decimal }> }>(
  goal: T,
) {
  const currentAmount = goal.savingsContributions.reduce(
    (sum, contribution) => sum.plus(contribution.amount),
    new Prisma.Decimal(0),
  );
  const progress = currentAmount.div(goal.targetAmount).mul(100);

  return {
    ...goal,
    currentAmount,
    progress,
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const goalId = parseGoalId(id);

  if (!goalId) {
    return jsonError("Invalid savings goal id", 400);
  }

  const goal = await prisma.savingsGoal.findUnique({
    where: { id: goalId },
    include: {
      savingsContributions: {
        orderBy: {
          contributionDate: "desc",
        },
      },
    },
  });

  if (!goal) {
    return jsonError("Savings goal not found", 404);
  }

  return NextResponse.json(attachSavingsProgress(goal));
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const goalId = parseGoalId(id);

    if (!goalId) {
      return jsonError("Invalid savings goal id", 400);
    }

    const body = savingsGoalUpdateSchema.parse(await request.json());

    const existingGoal = await prisma.savingsGoal.findUnique({
      where: { id: goalId },
    });

    if (!existingGoal) {
      return jsonError("Savings goal not found", 404);
    }

    const goal = await prisma.savingsGoal.update({
      where: { id: goalId },
      data: body,
      include: {
        savingsContributions: {
          orderBy: {
            contributionDate: "desc",
          },
        },
      },
    });

    return NextResponse.json(attachSavingsProgress(goal));
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
  const goalId = parseGoalId(id);

  if (!goalId) {
    return jsonError("Invalid savings goal id", 400);
  }

  const existingGoal = await prisma.savingsGoal.findUnique({
    where: { id: goalId },
  });

  if (!existingGoal) {
    return jsonError("Savings goal not found", 404);
  }

  await prisma.savingsGoal.delete({
    where: { id: goalId },
  });

  return new NextResponse(null, { status: 204 });
}
