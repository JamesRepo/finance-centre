import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enforceCredentialsRateLimit,
  getClientIp,
  logSkippedRateLimit,
  logFailedLoginAttempt,
} from "@/lib/auth-rate-limit";

describe("[Unit] getClientIp", () => {
  const originalTrustProxyHeaders = process.env.AUTH_TRUST_PROXY_HEADERS;

  beforeEach(() => {
    if (originalTrustProxyHeaders === undefined) {
      delete process.env.AUTH_TRUST_PROXY_HEADERS;
    } else {
      process.env.AUTH_TRUST_PROXY_HEADERS = originalTrustProxyHeaders;
    }
  });

  it("should return a trusted platform IP header when present", () => {
    const ip = getClientIp(
      new Headers({
        "cf-connecting-ip": "203.0.113.10",
      }),
    );

    expect(ip).toBe("203.0.113.10");
  });

  it("should ignore x-forwarded-for when proxy headers are not explicitly trusted", () => {
    const ip = getClientIp({
      "x-forwarded-for": "203.0.113.10, 198.51.100.1",
    });

    expect(ip).toBeNull();
  });

  it("should return the first forwarded IP when proxy headers are explicitly trusted", () => {
    process.env.AUTH_TRUST_PROXY_HEADERS = "true";

    const ip = getClientIp({
      "x-forwarded-for": "203.0.113.10, 198.51.100.1",
    });

    expect(ip).toBe("203.0.113.10");
  });

  it("should return null when no trusted IP headers are present", () => {
    const ip = getClientIp({});

    expect(ip).toBeNull();
  });
});

describe("[Unit] logFailedLoginAttempt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should write the timestamp, IP, and reason to the console", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logFailedLoginAttempt("203.0.113.20", "invalid_password");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[auth] Failed login attempt", {
      timestamp: expect.any(String),
      ip: "203.0.113.20",
      reason: "invalid_password",
    });
  });

  it("should log unavailable when the client IP cannot be determined", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logFailedLoginAttempt(null, "invalid_password");

    expect(warnSpy).toHaveBeenCalledWith("[auth] Failed login attempt", {
      timestamp: expect.any(String),
      ip: "unavailable",
      reason: "invalid_password",
    });
  });
});

describe("[Unit] logSkippedRateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should log when rate limiting is skipped because no trusted client IP is available", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logSkippedRateLimit("missing_trusted_ip");

    expect(warnSpy).toHaveBeenCalledWith("[auth] Skipped rate limit", {
      timestamp: expect.any(String),
      reason: "missing_trusted_ip",
    });
  });
});

describe("[Unit] enforceCredentialsRateLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should skip rate limiting when no trusted client IP is available", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await enforceCredentialsRateLimit(
        new NextRequest("http://localhost/api/auth/callback/credentials", {
          method: "POST",
          headers: {
            "x-forwarded-for": "203.0.113.30",
          },
        }),
      );

      expect(response).toBeNull();
    }

    expect(warnSpy).toHaveBeenCalledWith("[auth] Skipped rate limit", {
      timestamp: expect.any(String),
      reason: "missing_trusted_ip",
    });
  });

  it("should allow the first five attempts for an IP within one minute", async () => {
    const ip = "203.0.113.30";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await enforceCredentialsRateLimit(
        new NextRequest("http://localhost/api/auth/callback/credentials", {
          method: "POST",
          headers: {
            "cf-connecting-ip": ip,
          },
        }),
      );

      expect(response).toBeNull();
    }
  });

  it("should return 429 with retry metadata when the sixth attempt is made within one minute", async () => {
    const ip = "203.0.113.31";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await enforceCredentialsRateLimit(
        new NextRequest("http://localhost/api/auth/callback/credentials", {
          method: "POST",
          headers: {
            "cf-connecting-ip": ip,
          },
        }),
      );
    }

    const response = await enforceCredentialsRateLimit(
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "cf-connecting-ip": ip,
        },
      }),
    );

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
    await expect(response?.json()).resolves.toEqual({
      url: "http://localhost/login?error=RateLimitExceeded",
    });
    expect(warnSpy).toHaveBeenCalledWith("[auth] Failed login attempt", {
      timestamp: expect.any(String),
      ip,
      reason: "rate_limit_exceeded",
    });
  });
});
