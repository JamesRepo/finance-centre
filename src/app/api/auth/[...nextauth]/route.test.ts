import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHandler, mockNextAuth, mockEnforceCredentialsRateLimit } = vi.hoisted(() => {
  const mockHandler = vi.fn();

  return {
    mockHandler,
    mockNextAuth: vi.fn(() => mockHandler),
    mockEnforceCredentialsRateLimit: vi.fn(),
  };
});

vi.mock("next-auth", () => ({
  __esModule: true,
  default: mockNextAuth,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: { providers: [] },
}));

vi.mock("@/lib/auth-rate-limit", () => ({
  enforceCredentialsRateLimit: mockEnforceCredentialsRateLimit,
}));

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

const mockCtx = { params: Promise.resolve({ nextauth: ["callback", "credentials"] }) };

describe("[Unit] auth route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler.mockResolvedValue(
      NextResponse.json({ ok: true }, { status: 200 }),
    );
    mockEnforceCredentialsRateLimit.mockResolvedValue(null);
  });

  it("should bypass rate limiting when the request is not for the credentials callback", async () => {
    const request = new NextRequest("http://localhost/api/auth/signin/credentials", {
      method: "POST",
    });
    const ctx = { params: Promise.resolve({ nextauth: ["signin", "credentials"] }) };

    const response = await POST(request, ctx);

    expect(mockEnforceCredentialsRateLimit).not.toHaveBeenCalled();
    expect(mockHandler).toHaveBeenCalledWith(request, { params: { nextauth: ["signin", "credentials"] } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("should call the rate limiter before delegating credentials callback requests", async () => {
    const request = new NextRequest("http://localhost/api/auth/callback/credentials", {
      method: "POST",
    });

    const response = await POST(request, mockCtx);

    expect(mockEnforceCredentialsRateLimit).toHaveBeenCalledWith(request);
    expect(mockHandler).toHaveBeenCalledWith(request, { params: { nextauth: ["callback", "credentials"] } });
    expect(response.status).toBe(200);
  });

  it("should return the rate limit response without calling NextAuth when the limit is exceeded", async () => {
    const request = new NextRequest("http://localhost/api/auth/callback/credentials", {
      method: "POST",
    });
    const limitedResponse = NextResponse.json(
      { url: "http://localhost/login?error=RateLimitExceeded" },
      { status: 429 },
    );
    mockEnforceCredentialsRateLimit.mockResolvedValue(limitedResponse);

    const response = await POST(request, mockCtx);

    expect(mockEnforceCredentialsRateLimit).toHaveBeenCalledWith(request);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      url: "http://localhost/login?error=RateLimitExceeded",
    });
  });

  it("should resolve async params before passing to NextAuth handler", async () => {
    const request = new NextRequest("http://localhost/api/auth/callback/credentials", {
      method: "POST",
    });

    await POST(request, mockCtx);

    expect(mockHandler).toHaveBeenCalledWith(request, { params: { nextauth: ["callback", "credentials"] } });
  });
});

describe("[Unit] auth route GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler.mockResolvedValue(
      NextResponse.json({ ok: true }, { status: 200 }),
    );
  });

  it("should delegate to the NextAuth handler with resolved params", async () => {
    const request = new NextRequest("http://localhost/api/auth/session");
    const ctx = { params: Promise.resolve({ nextauth: ["session"] }) };

    await GET(request, ctx);

    expect(mockHandler).toHaveBeenCalledWith(request, { params: { nextauth: ["session"] } });
  });
});
