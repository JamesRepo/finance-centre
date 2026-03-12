import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { settingsUpdateSchema } from "@/lib/validators";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const publicFields = {
  id: true,
  currency: true,
  locale: true,
  monthlyBudgetTotal: true,
  updatedAt: true,
} as const;

export async function GET() {
  const settings = await prisma.settings.findFirst({ select: publicFields });

  if (!settings) {
    const created = await prisma.settings.create({ data: {}, select: publicFields });
    return NextResponse.json(created);
  }

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  try {
    const body = settingsUpdateSchema.parse(await request.json());

    const existing = await prisma.settings.findFirst();

    const settings = existing
      ? await prisma.settings.update({
          where: { id: existing.id },
          data: body,
          select: publicFields,
        })
      : await prisma.settings.create({
          data: {
            currency: body.currency ?? "GBP",
            locale: body.locale ?? "en-GB",
            monthlyBudgetTotal: body.monthlyBudgetTotal ?? undefined,
          },
          select: publicFields,
        });

    return NextResponse.json(settings);
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
