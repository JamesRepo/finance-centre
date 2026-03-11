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
    contributionId: string;
  }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id, contributionId } = await context.params;
  const goalId = parsePositiveInt(id);
  const parsedContributionId = parsePositiveInt(contributionId);

  if (!goalId) {
    return jsonError("Invalid savings goal id", 400);
  }

  if (!parsedContributionId) {
    return jsonError("Invalid contribution id", 400);
  }

  const contribution = await prisma.savingsContribution.findFirst({
    where: {
      id: parsedContributionId,
      goalId,
    },
  });

  if (!contribution) {
    return jsonError("Contribution not found", 404);
  }

  await prisma.savingsContribution.delete({
    where: { id: parsedContributionId },
  });

  return new NextResponse(null, { status: 204 });
}
