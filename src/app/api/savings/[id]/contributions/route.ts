import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { savingsContributionCreateSchema } from "@/lib/validators";

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
  });

  if (!goal) {
    return jsonError("Savings goal not found", 404);
  }

  const contributions = await prisma.savingsContribution.findMany({
    where: { goalId },
    orderBy: {
      contributionDate: "desc",
    },
  });

  return NextResponse.json(contributions);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const goalId = parseGoalId(id);

    if (!goalId) {
      return jsonError("Invalid savings goal id", 400);
    }

    const body = savingsContributionCreateSchema.parse(await request.json());

    const goal = await prisma.savingsGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      return jsonError("Savings goal not found", 404);
    }

    const contribution = await prisma.savingsContribution.create({
      data: {
        goalId,
        ...body,
      },
    });

    return NextResponse.json(contribution, { status: 201 });
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
