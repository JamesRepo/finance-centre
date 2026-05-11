import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  budgetPlanIdParamSchema,
  budgetPlanUpdateSchema,
} from "@/lib/validators";
import {
  formatMonthValue,
  getBudgetPlan,
  getMonthStart,
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

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const planId = await parsePlanId(context);
    const plan = await getBudgetPlan(planId);

    if (!plan) {
      return jsonError("Budget plan not found", 404);
    }

    return NextResponse.json(serializeBudgetPlan(plan));
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid budget plan id", 400);
    }

    throw error;
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const planId = await parsePlanId(context);
    const body = budgetPlanUpdateSchema.parse(await request.json());

    const existingPlan = await prisma.budgetPlan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
      return jsonError("Budget plan not found", 404);
    }

    const nextStartMonth = body.startMonth ?? formatMonthValue(existingPlan.startMonth);
    const nextEndMonth = body.endMonth ?? formatMonthValue(existingPlan.endMonth);

    if (nextEndMonth < nextStartMonth) {
      return jsonError("End month must be on or after start month", 400);
    }

    const plan = await prisma.budgetPlan.update({
      where: { id: planId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : undefined),
        ...(body.startMonth !== undefined
          ? { startMonth: getMonthStart(body.startMonth) }
          : undefined),
        ...(body.endMonth !== undefined
          ? { endMonth: getMonthStart(body.endMonth) }
          : undefined),
      },
      include: {
        items: {
          orderBy: [{ stream: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
        },
      },
    });

    return NextResponse.json(serializeBudgetPlan(plan));
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
    const planId = await parsePlanId(context);
    const existingPlan = await prisma.budgetPlan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
      return jsonError("Budget plan not found", 404);
    }

    await prisma.budgetPlan.delete({
      where: { id: planId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid budget plan id", 400);
    }

    throw error;
  }
}
