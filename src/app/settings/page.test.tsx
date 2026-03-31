// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const defaultSettingsData = {
  id: 1,
  currency: "GBP",
  locale: "en-GB",
  theme: "light",
  monthlyBudgetTotal: null,
  updatedAt: "2026-03-10T00:00:00.000Z",
};

describe("[Component] settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove("dark");
  });

  it("should show loading state while settings are being fetched", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  it("should render the form with default values after loading", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(defaultSettingsData)));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("GBP")).toHaveValue("GBP");
    expect(screen.getByPlaceholderText("en-GB")).toHaveValue("en-GB");
    expect(screen.getByRole("combobox")).toHaveValue("light");
    expect(screen.getByPlaceholderText("Optional")).toHaveValue(null);
  });

  it("should pre-populate the form when settings have a monthly budget total", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          ...defaultSettingsData,
          monthlyBudgetTotal: "2500",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Optional")).toHaveValue(2500);
    });
  });

  it("should pre-populate with custom currency and locale", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          ...defaultSettingsData,
          currency: "USD",
          locale: "en-US",
          theme: "dark",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("GBP")).toHaveValue("USD");
      expect(screen.getByPlaceholderText("en-GB")).toHaveValue("en-US");
      expect(screen.getByRole("combobox")).toHaveValue("dark");
    });
  });

  it("should render with defaults when the settings API fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ error: "fail" }, 500)));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("GBP")).toHaveValue("GBP");
    expect(screen.getByPlaceholderText("en-GB")).toHaveValue("en-GB");
    expect(screen.getByRole("combobox")).toHaveValue("light");
  });

  it("should render with defaults when the fetch throws a network error", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("Network error")));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("GBP")).toHaveValue("GBP");
  });

  it("should submit the form and show a success message", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(jsonResponse(defaultSettingsData));
      }
      return Promise.resolve(jsonResponse(defaultSettingsData));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Settings saved successfully.")).toBeInTheDocument();
    });

    // Should have called PUT on the settings API
    const putCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    expect(putCall![0]).toBe("/api/settings");

    const sentBody = JSON.parse(putCall![1]!.body as string);
    expect(sentBody).toMatchObject({
      currency: "GBP",
      locale: "en-GB",
      theme: "light",
      monthlyBudgetTotal: null,
    });
  });

  it("should submit the selected theme", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(jsonResponse({ ...defaultSettingsData, theme: "dark" }));
      }
      return Promise.resolve(jsonResponse(defaultSettingsData));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole("combobox"), "dark");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Settings saved successfully.")).toBeInTheDocument();
    });

    const putCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "PUT",
    );
    const sentBody = JSON.parse(putCall![1]!.body as string);
    expect(sentBody.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("should send the monthly budget total as a number when provided", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(jsonResponse(defaultSettingsData));
      }
      return Promise.resolve(jsonResponse(defaultSettingsData));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    const budgetInput = screen.getByPlaceholderText("Optional");
    await user.type(budgetInput, "3000");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Settings saved successfully.")).toBeInTheDocument();
    });

    const putCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "PUT",
    );
    const sentBody = JSON.parse(putCall![1]!.body as string);
    expect(sentBody.monthlyBudgetTotal).toBe(3000);
  });

  it("should show an error message when the save fails", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(jsonResponse({ error: "Server error" }, 500));
      }
      return Promise.resolve(jsonResponse(defaultSettingsData));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
    expect(screen.queryByText("Settings saved successfully.")).not.toBeInTheDocument();
  });

  it("should show a fallback error message when the API error has no body", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(
          new Response("Internal server error", {
            status: 500,
            headers: { "content-type": "text/plain" },
          }),
        );
      }
      return Promise.resolve(jsonResponse(defaultSettingsData));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to save settings")).toBeInTheDocument();
    });
  });

  it("should show an error when the save throws a network error", async () => {
    const user = userEvent.setup();

    let callCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.reject(new Error("Network failure"));
      }
      callCount++;
      return Promise.resolve(jsonResponse(defaultSettingsData));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });
  });

  it("should disable the save button while saving", async () => {
    const user = userEvent.setup();

    let resolvePut: (value: Response) => void;
    const putPromise = new Promise<Response>((resolve) => {
      resolvePut = resolve;
    });

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return putPromise;
      }
      return Promise.resolve(jsonResponse(defaultSettingsData));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    resolvePut!(jsonResponse(defaultSettingsData));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save settings" })).toBeEnabled();
    });
  });

  it("should render the page heading and description", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(defaultSettingsData)));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Finance Centre")).toBeInTheDocument();
    expect(
      screen.getByText("Configure your currency, locale, theme, and optional monthly budget total."),
    ).toBeInTheDocument();
  });

  it("should render the monthly budget total hint text", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(defaultSettingsData)));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    expect(
      screen.getByText("Leave blank to calculate from individual category budgets."),
    ).toBeInTheDocument();
  });

  it("should render all three form fields with labels", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(defaultSettingsData)));
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Currency")).toBeInTheDocument();
    expect(screen.getByText("Locale")).toBeInTheDocument();
    expect(screen.getByText("Monthly budget total")).toBeInTheDocument();
  });
});
