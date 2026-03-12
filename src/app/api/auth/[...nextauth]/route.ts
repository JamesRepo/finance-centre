import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { enforceCredentialsRateLimit } from "@/lib/auth-rate-limit";

const handler = NextAuth(authOptions);

export const GET = handler;

export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("/callback/credentials")) {
    const rateLimitResponse = await enforceCredentialsRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  return handler(request);
}
