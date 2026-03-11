import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  incomeSourceCreateWithDeductionsSchema,
  incomeSourceListQuerySchema,
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

function attachTotalDeductions<T extends { incomeDeductions: Array<{ amount: Prisma.Decimal }> }>(
  incomeSource: T,
) {
  const totalDeductions = incomeSource.incomeDeductions.reduce(
    (sum, deduction) => sum.plus(deduction.amount),
    new Prisma.Decimal(0),
  );

  return {
    ...incomeSource,
    totalDeductions,
  };
}

export async function GET(request: NextRequest) {
  try {
    const query = incomeSourceListQuerySchema.parse({
      month: request.nextUrl.searchParams.get("month") ?? undefined,
    });

    const incomeSources = await prisma.incomeSource.findMany({
      where: query.month
        ? {
            incomeDate: getMonthRange(query.month),
          }
        : undefined,
      include: {
        incomeDeductions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        incomeDate: "desc",
      },
    });

    return NextResponse.json(incomeSources.map(attachTotalDeductions));
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters", 400);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = incomeSourceCreateWithDeductionsSchema.parse(await request.json());
    const { deductions = [], ...incomeSourceData } = body;

    const incomeSource = await prisma.incomeSource.create({
      data: {
        ...incomeSourceData,
        ...(deductions.length > 0
          ? {
              incomeDeductions: {
                create: deductions,
              },
            }
          : undefined),
      },
      include: {
        incomeDeductions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return NextResponse.json(attachTotalDeductions(incomeSource), { status: 201 });
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
