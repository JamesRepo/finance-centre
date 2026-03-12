import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    settings: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

const { mockCompare } = vi.hoisted(() => ({
  mockCompare: vi.fn(),
}));

vi.mock("bcrypt", () => ({
  default: { compare: mockCompare },
  compare: mockCompare,
}));

const { mockGetClientIp, mockLogFailedLoginAttempt } = vi.hoisted(() => ({
  mockGetClientIp: vi.fn(),
  mockLogFailedLoginAttempt: vi.fn(),
}));

vi.mock("@/lib/auth-rate-limit", () => ({
  getClientIp: mockGetClientIp,
  logFailedLoginAttempt: mockLogFailedLoginAttempt,
}));

import { authOptions } from "@/lib/auth";

const credentialsProvider = authOptions.providers[0];

function getAuthorize() {
  // The authorize function is nested in the Credentials provider config.
  // Access it via the provider's options.
  // In next-auth v4, CredentialsProvider returns an object with an `authorize` method
  // accessible via the provider's options property.
  return (credentialsProvider as unknown as {
    options: {
      authorize: (
        credentials: Record<string, string> | undefined,
        req: { headers: Headers | Record<string, string> },
      ) => Promise<unknown>;
    };
  }).options.authorize;
}

const credentialsRequest = {
  headers: new Headers({
    "x-forwarded-for": "203.0.113.40",
  }),
};

const settingsWithAuth = {
  id: 1,
  currency: "GBP",
  locale: "en-GB",
  monthlyBudgetTotal: null,
  email: "user@example.com",
  passwordHash: "$2b$12$hashedpassword",
  updatedAt: new Date(),
};

describe("[Unit] authOptions", () => {
  it("should use JWT session strategy", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("should set session max age to 7 days", () => {
    expect(authOptions.session?.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it("should configure custom sign-in page at /login", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
  });

  it("should have exactly one Credentials provider", () => {
    expect(authOptions.providers).toHaveLength(1);
    expect(credentialsProvider.id).toBe("credentials");
  });
});

describe("[Unit] authorize callback", () => {
  let authorize: ReturnType<typeof getAuthorize>;

  beforeEach(() => {
    vi.clearAllMocks();
    authorize = getAuthorize();
    mockGetClientIp.mockReturnValue("203.0.113.40");
  });

  it("should return null when credentials are undefined", async () => {
    const result = await authorize(undefined, credentialsRequest);
    expect(result).toBeNull();
    expect(mockPrisma.settings.findFirst).not.toHaveBeenCalled();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "missing_credentials",
    );
  });

  it("should return null when email is missing from credentials", async () => {
    const result = await authorize({ password: "secret" }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockPrisma.settings.findFirst).not.toHaveBeenCalled();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "missing_credentials",
    );
  });

  it("should return null when password is missing from credentials", async () => {
    const result = await authorize({ email: "user@example.com" }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockPrisma.settings.findFirst).not.toHaveBeenCalled();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "missing_credentials",
    );
  });

  it("should return null when email is empty string", async () => {
    const result = await authorize({ email: "", password: "secret" }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "missing_credentials",
    );
  });

  it("should return null when password is empty string", async () => {
    const result = await authorize({ email: "user@example.com", password: "" }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "missing_credentials",
    );
  });

  it("should return null when no settings row exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(null);

    const result = await authorize({
      email: "user@example.com",
      password: "secret",
    }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "auth_not_configured",
    );
  });

  it("should return null when settings has no email configured", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      ...settingsWithAuth,
      email: null,
    });

    const result = await authorize({
      email: "user@example.com",
      password: "secret",
    }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "auth_not_configured",
    );
  });

  it("should return null when settings has no passwordHash configured", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      ...settingsWithAuth,
      passwordHash: null,
    });

    const result = await authorize({
      email: "user@example.com",
      password: "secret",
    }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "auth_not_configured",
    );
  });

  it("should return null when email does not match stored email", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(settingsWithAuth);

    const result = await authorize({
      email: "wrong@example.com",
      password: "secret",
    }, credentialsRequest);
    expect(result).toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "invalid_email",
    );
  });

  it("should match email case-insensitively", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(settingsWithAuth);
    mockCompare.mockResolvedValue(true);

    const result = await authorize({
      email: "User@Example.COM",
      password: "correctpassword",
    }, credentialsRequest);

    expect(result).toEqual({ id: "1", email: "user@example.com" });
    expect(mockCompare).toHaveBeenCalled();
    expect(mockLogFailedLoginAttempt).not.toHaveBeenCalled();
  });

  it("should return null when password does not match stored hash", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(settingsWithAuth);
    mockCompare.mockResolvedValue(false);

    const result = await authorize({
      email: "user@example.com",
      password: "wrongpassword",
    }, credentialsRequest);

    expect(result).toBeNull();
    expect(mockCompare).toHaveBeenCalledWith(
      "wrongpassword",
      settingsWithAuth.passwordHash,
    );
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      "203.0.113.40",
      "invalid_password",
    );
  });

  it("should return user object when email and password are valid", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(settingsWithAuth);
    mockCompare.mockResolvedValue(true);

    const result = await authorize({
      email: "user@example.com",
      password: "correctpassword",
    }, credentialsRequest);

    expect(result).toEqual({ id: "1", email: "user@example.com" });
    expect(mockCompare).toHaveBeenCalledWith(
      "correctpassword",
      settingsWithAuth.passwordHash,
    );
    expect(mockLogFailedLoginAttempt).not.toHaveBeenCalled();
  });

  it("should call bcrypt.compare with the provided password and stored hash", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(settingsWithAuth);
    mockCompare.mockResolvedValue(true);

    await authorize({
      email: "user@example.com",
      password: "mypassword",
    }, credentialsRequest);

    expect(mockCompare).toHaveBeenCalledOnce();
    expect(mockCompare).toHaveBeenCalledWith(
      "mypassword",
      "$2b$12$hashedpassword",
    );
  });

  it("should log unavailable when no trusted client IP is available", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(settingsWithAuth);
    mockGetClientIp.mockReturnValue(null);

    const result = await authorize({
      email: "wrong@example.com",
      password: "secret",
    }, credentialsRequest);

    expect(result).toBeNull();
    expect(mockLogFailedLoginAttempt).toHaveBeenCalledWith(
      null,
      "invalid_email",
    );
  });
});
