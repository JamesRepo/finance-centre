// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PwaProvider } from "./pwa-provider";

const mockRegister = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register: mockRegister },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("[Unit] PwaProvider", () => {
  it("should not show offline banner when online", () => {
    render(<PwaProvider />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should show offline banner when browser is offline on mount", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<PwaProvider />);
    expect(screen.getByRole("status")).toHaveTextContent("offline");
  });

  it("should show offline banner on offline event", () => {
    render(<PwaProvider />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("status")).toHaveTextContent("offline");
  });

  it("should hide offline banner on online event", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<PwaProvider />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should register the service worker on mount", () => {
    render(<PwaProvider />);
    expect(mockRegister).toHaveBeenCalledWith("/sw.js");
  });
});
