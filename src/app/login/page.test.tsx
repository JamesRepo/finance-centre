// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignIn } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import LoginPage from "@/app/login/page";

describe("[Component] LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the sign-in heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("should render the Finance Centre label", () => {
    render(<LoginPage />);
    expect(screen.getByText("Finance Centre")).toBeInTheDocument();
  });

  it("should render an email input field", () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("name", "email");
    expect(emailInput).toBeRequired();
  });

  it("should render a password input field", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("name", "password");
    expect(passwordInput).toBeRequired();
  });

  it("should render a sign-in button", () => {
    render(<LoginPage />);
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "submit");
    expect(button).not.toBeDisabled();
  });

  it("should not display an error message initially", () => {
    render(<LoginPage />);
    expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
  });

  it("should call signIn with credentials on form submission", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ error: null });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "password123",
      redirect: false,
    });
  });

  it("should redirect to dashboard on successful sign-in", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ error: null });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockPush).toHaveBeenCalledWith("/");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("should display an error message on failed sign-in", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("should not redirect on failed sign-in", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByText("Invalid email or password");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should show 'Signing in...' on the button while submitting", async () => {
    const user = userEvent.setup();
    let resolveSignIn: (value: unknown) => void;
    mockSignIn.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();

    resolveSignIn!({ error: null });
  });

  it("should re-enable the button after a failed sign-in attempt", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByText("Invalid email or password");

    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).not.toBeDisabled();
  });

  it("should clear a previous error when submitting again", async () => {
    const user = userEvent.setup();
    mockSignIn
      .mockResolvedValueOnce({ error: "CredentialsSignin" })
      .mockResolvedValueOnce({ error: null });

    render(<LoginPage />);

    // First attempt — fails
    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Invalid email or password");

    // Second attempt — clears error before resolving
    await user.clear(screen.getByLabelText("Email"));
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
  });

  it("should set autocomplete attributes on inputs", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });
});
