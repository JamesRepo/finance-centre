import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { transactionSummaryQuerySchema } from "@/lib/validators";
import { ZodError } from "zod";

type DateRange = {
  gte: Date;
  lt: Date;
};

type WeekBucket = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  total: Prisma.Decimal;
};

type MonthBucket = {
  month: string;
  total: Prisma.Decimal;
};

type DayBucket = {
  date: string;
  total: Prisma.Decimal;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getCurrentUtcMonth() {
  return formatUtcMonth(new Date());
}

function getCurrentUtcYear() {
  return String(new Date().getUTCFullYear());
}

function formatUtcMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
  );
}

function getMonthRange(month: string): DateRange {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function getMonthStart(month: string) {
  return getMonthRange(month).gte;
}

function getYearRange(year: string): DateRange {
  const parsedYear = Number(year);

  return {
    gte: new Date(Date.UTC(parsedYear, 0, 1)),
    lt: new Date(Date.UTC(parsedYear + 1, 0, 1)),
  };
}

function getUtcWeekRangeContaining(date: Date): DateRange {
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const gte = addUtcDays(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
    -daysFromMonday,
  );

  return {
    gte,
    lt: addUtcDays(gte, 7),
  };
}

function getDaysUntilNextMonday(date: Date) {
  const daysFromMonday = (date.getUTCDay() + 6) % 7;

  return 7 - daysFromMonday;
}

function getMonthWeekRanges(month: string): Array<{ weekNumber: number; range: DateRange }> {
  const monthRange = getMonthRange(month);
  const weeks: Array<{ weekNumber: number; range: DateRange }> = [];
  let cursor = monthRange.gte;
  let weekNumber = 1;

  while (cursor < monthRange.lt) {
    const weekEndExclusive = addUtcDays(cursor, getDaysUntilNextMonday(cursor));
    const range = {
      gte: cursor,
      lt: weekEndExclusive < monthRange.lt ? weekEndExclusive : monthRange.lt,
    };

    weeks.push({
      weekNumber,
      range,
    });

    cursor = range.lt;
    weekNumber += 1;
  }

  return weeks;
}

function zeroDecimal() {
  return new Prisma.Decimal(0);
}

async function getRangeTotal(transactionDate: DateRange) {
  const result = await prisma.transaction.aggregate({
    where: {
      transactionDate,
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount ?? zeroDecimal();
}

async function getCategorySummary(transactionDate: DateRange) {
  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      transactionDate,
    },
    _sum: {
      amount: true,
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _sum: {
        amount: "desc",
      },
    },
  });

  const categories = grouped.length
    ? await prisma.category.findMany({
        where: {
          id: {
            in: grouped.map((entry) => entry.categoryId),
          },
        },
      })
    : [];

  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return grouped.map((entry) => {
    const category = categoriesById.get(entry.categoryId);

    return {
      categoryId: entry.categoryId,
      categoryName: category?.name ?? "Unknown",
      colorCode: category?.colorCode ?? null,
      total: entry._sum.amount ?? zeroDecimal(),
      transactionCount: entry._count._all,
    };
  });
}

async function getMonthBreakdown(year: string): Promise<MonthBucket[]> {
  const parsedYear = Number(year);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(parsedYear, index, 1));

    return {
      month: formatUtcMonth(date),
      range: {
        gte: date,
        lt: new Date(Date.UTC(parsedYear, index + 1, 1)),
      },
    };
  });

  const totals = await Promise.all(
    months.map(async ({ range }) => getRangeTotal(range)),
  );

  return months.map(({ month }, index) => ({
    month,
    total: totals[index],
  }));
}

async function getWeekBreakdown(month: string): Promise<WeekBucket[]> {
  const weeks = getMonthWeekRanges(month);
  const totals = await Promise.all(
    weeks.map(async ({ range }) => getRangeTotal(range)),
  );

  return weeks.map(({ weekNumber, range }, index) => ({
    weekNumber,
    weekStart: formatUtcDate(range.gte),
    weekEnd: formatUtcDate(addUtcDays(range.lt, -1)),
    total: totals[index],
  }));
}

async function getDayBreakdown(transactionDate: DateRange): Promise<DayBucket[]> {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(transactionDate.gte, index);

    return {
      date: formatUtcDate(date),
      range: {
        gte: date,
        lt: addUtcDays(date, 1),
      },
    };
  });

  const totals = await Promise.all(days.map(async ({ range }) => getRangeTotal(range)));

  return days.map(({ date }, index) => ({
    date,
    total: totals[index],
  }));
}

export async function GET(request: NextRequest) {
  try {
    const query = transactionSummaryQuerySchema.parse({
      period: request.nextUrl.searchParams.get("period") ?? undefined,
      month: request.nextUrl.searchParams.get("month") ?? undefined,
      year: request.nextUrl.searchParams.get("year") ?? undefined,
    });

    if (query.period === "year") {
      const year = query.year ?? getCurrentUtcYear();
      const transactionDate = getYearRange(year);
      const [totalSpent, byCategory, byMonth] = await Promise.all([
        getRangeTotal(transactionDate),
        getCategorySummary(transactionDate),
        getMonthBreakdown(year),
      ]);

      return NextResponse.json({
        totalSpent,
        byCategory,
        byMonth,
      });
    }

    if (query.period === "week") {
      const month = query.month ?? getCurrentUtcMonth();
      const transactionDate = getUtcWeekRangeContaining(getMonthStart(month));
      const [totalSpent, byCategory, byDay] = await Promise.all([
        getRangeTotal(transactionDate),
        getCategorySummary(transactionDate),
        getDayBreakdown(transactionDate),
      ]);

      return NextResponse.json({
        totalSpent,
        byCategory,
        byDay,
      });
    }

    const month = query.month ?? getCurrentUtcMonth();
    const transactionDate = getMonthRange(month);
    const [totalSpent, byCategory, byWeek] = await Promise.all([
      getRangeTotal(transactionDate),
      getCategorySummary(transactionDate),
      getWeekBreakdown(month),
    ]);

    return NextResponse.json({
      totalSpent,
      byCategory,
      byWeek,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters", 400);
    }

    throw error;
  }
}
