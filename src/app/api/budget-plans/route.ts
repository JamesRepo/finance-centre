import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { budgetPlanCreateSchema } from "@/lib/validators";
import {
  buildSeedItems,
  formatMonthValue,
  getMonthStart,
  serializeBudgetPlan,
} from "@/lib/budget-plans/service";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const plans = await prisma.budgetPlan.findMany({
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      startMonth: formatMonthValue(plan.startMonth),
      endMonth: formatMonthValue(plan.endMonth),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      itemCount: plan._count.items,
    })),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = budgetPlanCreateSchema.parse(await request.json());
    const items = await buildSeedItems(body.startMonth);

    const plan = await prisma.budgetPlan.create({
      data: {
        name: body.name,
        startMonth: getMonthStart(body.startMonth),
        endMonth: getMonthStart(body.endMonth),
        items: {
          create: items,
        },
      },
      include: {
        items: {
          orderBy: [{ stream: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
        },
      },
    });

    return NextResponse.json(serializeBudgetPlan(plan), { status: 201 });
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
      return jsonError("Budget plan already exists", 409);
    }

    throw error;
  }
}
