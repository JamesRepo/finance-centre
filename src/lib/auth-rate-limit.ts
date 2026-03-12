import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
const UNAVAILABLE_IP = "unavailable";
const TRUST_PROXY_HEADERS_ENV = "AUTH_TRUST_PROXY_HEADERS";
const TRUSTED_IP_HEADER_NAMES = [
  "cf-connecting-ip",
  "fly-client-ip",
  "fastly-client-ip",
  "true-client-ip",
] as const;

const authRateLimiter = new RateLimiterMemory({
  keyPrefix: "auth_credentials",
  points: AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  duration: AUTH_RATE_LIMIT_WINDOW_SECONDS,
});

type HeaderValue = string | string[] | undefined;
type HeaderSource = Headers | Record<string, HeaderValue>;

function readHeader(headers: HeaderSource, name: string) {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getClientIp(headers: HeaderSource) {
  for (const headerName of TRUSTED_IP_HEADER_NAMES) {
    const value = readHeader(headers, headerName)?.trim();
    if (value) {
      return value;
    }
  }

  if (process.env[TRUST_PROXY_HEADERS_ENV] === "true") {
    const forwardedFor = readHeader(headers, "x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() || null;
    }

    const realIp = readHeader(headers, "x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
  }

  return null;
}

export function logFailedLoginAttempt(ip: string | null, reason: string) {
  console.warn("[auth] Failed login attempt", {
    timestamp: new Date().toISOString(),
    ip: ip ?? UNAVAILABLE_IP,
    reason,
  });
}

export function logSkippedRateLimit(reason: string) {
  console.warn("[auth] Skipped rate limit", {
    timestamp: new Date().toISOString(),
    reason,
  });
}

export async function enforceCredentialsRateLimit(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!ip) {
    logSkippedRateLimit("missing_trusted_ip");
    return null;
  }

  try {
    await authRateLimiter.consume(ip);
    return null;
  } catch (error) {
    const msBeforeNext =
      (error as { msBeforeNext?: number } | undefined)?.msBeforeNext ?? 1000;
    const retryAfterSeconds = Math.max(1, Math.ceil(msBeforeNext / 1000));

    logFailedLoginAttempt(ip, "rate_limit_exceeded");

    return NextResponse.json(
      {
        url: new URL(
          "/login?error=RateLimitExceeded",
          request.nextUrl.origin,
        ).toString(),
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
        },
      },
    );
  }
}
