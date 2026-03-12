import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("[Unit] next config security headers", () => {
  it("should define a headers function for route-level response headers", () => {
    expect(nextConfig.headers).toBeTypeOf("function");
  });

  it("should apply the security headers to every route when headers are resolved", async () => {
    const headerRules = await nextConfig.headers?.();

    expect(headerRules).toEqual([
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]);
  });

  it("should include each required security header exactly once when headers are resolved", async () => {
    const headerRules = await nextConfig.headers?.();
    const headerKeys = headerRules?.[0]?.headers.map((header) => header.key);

    expect(headerKeys).toEqual([
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Content-Security-Policy",
      "Permissions-Policy",
    ]);
  });
});
