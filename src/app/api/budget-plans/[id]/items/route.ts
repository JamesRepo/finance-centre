import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  budgetPlanIdParamSchema,
  budgetPlanItemCreateSchema,
} from "@/lib/validators";
import {
  getBudgetPlan,
  getNextSortOrder,
  serializeBudgetPlan,
} from "@/lib/budget-plans/service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function parsePlanId(context: RouteContext) {
  const params = await context.params;
  return budgetPlanIdParamSchema.parse(params).id;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const planId = await parsePlanId(context);
    const body = budgetPlanItemCreateSchema.parse(await request.json());
    const plan = await prisma.budgetPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return jsonError("Budget plan not found", 404);
    }

    await prisma.budgetPlanItem.create({
      data: {
        planId,
        stream: body.stream,
        sourceId: null,
        label: body.label,
        amount: body.amount,
        cadence: body.cadence,
        colorCode: body.colorCode,
        sortOrder: await getNextSortOrder(planId, body.stream),
        isCustom: true,
        enabled: true,
      },
    });

    const updatedPlan = await getBudgetPlan(planId);

    if (!updatedPlan) {
      return jsonError("Budget plan not found", 404);
    }

    return NextResponse.json(serializeBudgetPlan(updatedPlan), { status: 201 });
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
