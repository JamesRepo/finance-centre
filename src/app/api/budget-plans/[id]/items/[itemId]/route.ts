import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  budgetPlanItemIdParamSchema,
  budgetPlanItemUpdateSchema,
} from "@/lib/validators";
import {
  getBudgetPlan,
  serializeBudgetPlan,
} from "@/lib/budget-plans/service";

type RouteContext = {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function parseParams(context: RouteContext) {
  const params = await context.params;
  return budgetPlanItemIdParamSchema.parse(params);
}

async function getPlanResponse(planId: number) {
  const plan = await getBudgetPlan(planId);

  if (!plan) {
    return null;
  }

  return serializeBudgetPlan(plan);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: planId, itemId } = await parseParams(context);
    const body = budgetPlanItemUpdateSchema.parse(await request.json());
    const existingItem = await prisma.budgetPlanItem.findFirst({
      where: { id: itemId, planId },
    });

    if (!existingItem) {
      return jsonError("Budget plan item not found", 404);
    }

    await prisma.budgetPlanItem.update({
      where: { id: itemId },
      data: body,
    });

    const planResponse = await getPlanResponse(planId);

    if (!planResponse) {
      return jsonError("Budget plan not found", 404);
    }

    return NextResponse.json(planResponse);
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
  try {
    const { id: planId, itemId } = await parseParams(context);
    const existingItem = await prisma.budgetPlanItem.findFirst({
      where: { id: itemId, planId },
    });

    if (!existingItem) {
      return jsonError("Budget plan item not found", 404);
    }

    if (existingItem.isCustom) {
      await prisma.budgetPlanItem.delete({
        where: { id: itemId },
      });
    } else {
      await prisma.budgetPlanItem.update({
        where: { id: itemId },
        data: { enabled: false },
      });
    }

    const planResponse = await getPlanResponse(planId);

    if (!planResponse) {
      return jsonError("Budget plan not found", 404);
    }

    return NextResponse.json(planResponse);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid budget plan item id", 400);
    }

    throw error;
  }
}
