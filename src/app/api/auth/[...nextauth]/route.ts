import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { enforceCredentialsRateLimit } from "@/lib/auth-rate-limit";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return handler(req, { params: await ctx.params });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  if (request.nextUrl.pathname.endsWith("/callback/credentials")) {
    const rateLimitResponse = await enforceCredentialsRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  return handler(request, { params: await ctx.params });
}
