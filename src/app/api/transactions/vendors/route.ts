import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { transactionVendorLookupQuerySchema } from "@/lib/validators";

const DEFAULT_VENDOR_LIMIT = 8;
const VENDOR_LOOKUP_BATCH_SIZE = 100;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const query = transactionVendorLookupQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const vendors = new Set<string>();
    const suggestions: string[] = [];
    const suggestionLimit = query.limit ?? DEFAULT_VENDOR_LIMIT;
    let skip = 0;

    while (suggestions.length < suggestionLimit) {
      const transactions = await prisma.transaction.findMany({
        where: {
          vendor: {
            not: null,
            ...(query.q
              ? {
                  contains: query.q,
                  mode: "insensitive" as const,
                }
              : undefined),
          },
        },
        select: {
          vendor: true,
        },
        orderBy: {
          transactionDate: "desc",
        },
        skip,
        take: VENDOR_LOOKUP_BATCH_SIZE,
      });

      if (transactions.length === 0) {
        break;
      }

      for (const transaction of transactions) {
        const vendor = transaction.vendor?.trim();

        if (!vendor) {
          continue;
        }

        const normalizedVendor = vendor.toLowerCase();

        if (vendors.has(normalizedVendor)) {
          continue;
        }

        vendors.add(normalizedVendor);
        suggestions.push(vendor);

        if (suggestions.length >= suggestionLimit) {
          break;
        }
      }

      if (transactions.length < VENDOR_LOOKUP_BATCH_SIZE) {
        break;
      }

      skip += VENDOR_LOOKUP_BATCH_SIZE;
    }

    return NextResponse.json(suggestions);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters", 400);
    }

    throw error;
  }
}
