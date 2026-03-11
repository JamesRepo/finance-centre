import { type NextRequest, NextResponse } from "next/server";
import { Prisma, type SavingsPriority } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { savingsGoalCreateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const priorityOrder: Record<SavingsPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

function attachSavingsProgress<
  T extends {
    targetAmount: Prisma.Decimal;
    savingsContributions: Array<{ amount: Prisma.Decimal }>;
    priority: SavingsPriority | null;
  },
>(goal: T) {
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

export async function GET() {
  const goals = await prisma.savingsGoal.findMany({
    include: {
      savingsContributions: true,
    },
  });

  const goalsWithProgress = goals.map(attachSavingsProgress);

  goalsWithProgress.sort((left, right) => {
    const leftPriority = left.priority ? priorityOrder[left.priority] : Number.POSITIVE_INFINITY;
    const rightPriority = right.priority ? priorityOrder[right.priority] : Number.POSITIVE_INFINITY;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.name.localeCompare(right.name);
  });

  return NextResponse.json(goalsWithProgress);
}

export async function POST(request: NextRequest) {
  try {
    const body = savingsGoalCreateSchema.parse(await request.json());

    const goal = await prisma.savingsGoal.create({
      data: body,
      include: {
        savingsContributions: true,
      },
    });

    return NextResponse.json(attachSavingsProgress(goal), { status: 201 });
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
