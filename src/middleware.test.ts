import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetToken } = vi.hoisted(() => ({
  mockGetToken: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

import { middleware, config } from "@/middleware";
import { NextRequest } from "next/server";

function makeRequest(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("[Unit] auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("should redirect to /login when there is no token", async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("should allow the request through when a valid token exists", async () => {
    mockGetToken.mockResolvedValue({ sub: "1", email: "user@example.com" });

    const response = await middleware(makeRequest("/"));

    // NextResponse.next() returns a 200
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should redirect to /login for protected API routes when unauthenticated", async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest("/api/settings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("should pass the secret from environment to getToken", async () => {
    mockGetToken.mockResolvedValue(null);

    await middleware(makeRequest("/dashboard"));

    expect(mockGetToken).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "test-secret" }),
    );
  });

  it("should allow authenticated requests to any protected path", async () => {
    mockGetToken.mockResolvedValue({ sub: "1" });

    const paths = ["/", "/transactions", "/budgets", "/settings", "/api/budgets"];
    for (const path of paths) {
      const response = await middleware(makeRequest(path));
      expect(response.status).toBe(200);
    }
  });
});

describe("[Unit] middleware matcher config", () => {
  // Next.js interprets matcher patterns via path-to-regexp, not as raw JS RegExp.
  // We validate the config shape and exclusion patterns declaratively.
  const pattern = config.matcher[0];

  it("should export a single matcher pattern", () => {
    expect(config.matcher).toHaveLength(1);
  });

  it("should exclude /login from matching", () => {
    expect(pattern).toContain("login");
    // The negative lookahead excludes login paths
    expect(pattern).toMatch(/\(\?!.*login/);
  });

  it("should exclude /api/auth from matching", () => {
    expect(pattern).toContain("api/auth");
    expect(pattern).toMatch(/\(\?!.*api\/auth/);
  });

  it("should exclude Next.js static assets from matching", () => {
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
  });

  it("should exclude favicon.ico from matching", () => {
    expect(pattern).toContain("favicon");
  });
});
