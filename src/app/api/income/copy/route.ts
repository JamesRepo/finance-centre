import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { incomeSourceCopySchema } from "@/lib/validators";

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

function getIncomeDateForTargetMonth(incomeDate: Date, targetMonth: string) {
  const [year, monthNumber] = targetMonth.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dayOfMonth = Math.min(incomeDate.getUTCDate(), lastDayOfMonth);

  return new Date(Date.UTC(year, monthNumber - 1, dayOfMonth));
}

function getDuplicateKey(incomeSource: {
  incomeType: string;
  description: string | null;
  grossAmount: { toString(): string };
  netAmount: { toString(): string };
  incomeDate: Date;
}) {
  return [
    incomeSource.incomeType,
    incomeSource.description ?? "",
    incomeSource.grossAmount.toString(),
    incomeSource.netAmount.toString(),
    incomeSource.incomeDate.getUTCDate(),
  ].join("\u001f");
}

export async function POST(request: NextRequest) {
  try {
    const body = incomeSourceCopySchema.parse(await request.json());

    const sourceMonthRange = getMonthRange(body.sourceMonth);
    const targetMonthRange = getMonthRange(body.targetMonth);

    const [sourceIncomeSources, targetIncomeSources] = await Promise.all([
      prisma.incomeSource.findMany({
        where: {
          incomeDate: sourceMonthRange,
        },
        include: {
          incomeDeductions: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: [{ incomeDate: "asc" }, { incomeType: "asc" }],
      }),
      prisma.incomeSource.findMany({
        where: {
          incomeDate: targetMonthRange,
        },
        select: {
          incomeType: true,
          description: true,
          grossAmount: true,
          netAmount: true,
          incomeDate: true,
        },
      }),
    ]);

    const existingTargetKeys = new Set(targetIncomeSources.map(getDuplicateKey));
    const incomeSourcesToCopy = sourceIncomeSources.filter((incomeSource) => {
      const targetIncomeSource = {
        ...incomeSource,
        incomeDate: getIncomeDateForTargetMonth(incomeSource.incomeDate, body.targetMonth),
      };

      return !existingTargetKeys.has(getDuplicateKey(targetIncomeSource));
    });

    if (incomeSourcesToCopy.length > 0) {
      await prisma.$transaction(
        incomeSourcesToCopy.map((incomeSource) =>
          prisma.incomeSource.create({
            data: {
              incomeType: incomeSource.incomeType,
              description: incomeSource.description,
              grossAmount: incomeSource.grossAmount,
              netAmount: incomeSource.netAmount,
              incomeDate: getIncomeDateForTargetMonth(
                incomeSource.incomeDate,
                body.targetMonth,
              ),
              isRecurring: incomeSource.isRecurring,
              recurrenceFrequency: incomeSource.recurrenceFrequency,
              isActive: incomeSource.isActive,
              ...(incomeSource.incomeDeductions.length > 0
                ? {
                    incomeDeductions: {
                      create: incomeSource.incomeDeductions.map((deduction) => ({
                        deductionType: deduction.deductionType,
                        name: deduction.name,
                        amount: deduction.amount,
                        isPercentage: deduction.isPercentage,
                        percentageValue: deduction.percentageValue,
                        isActive: deduction.isActive,
                      })),
                    },
                  }
                : undefined),
            },
          }),
        ),
      );
    }

    return NextResponse.json({
      copiedCount: incomeSourcesToCopy.length,
      skippedCount: sourceIncomeSources.length - incomeSourcesToCopy.length,
    });
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
