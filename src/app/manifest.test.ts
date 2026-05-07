import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("[Unit] web app manifest", () => {
  const m = manifest();

  it("should have the correct app name", () => {
    expect(m.name).toBe("Finance Centre");
    expect(m.short_name).toBe("Finance");
  });

  it("should use standalone display mode", () => {
    expect(m.display).toBe("standalone");
  });

  it("should start at the root URL", () => {
    expect(m.start_url).toBe("/");
  });

  it("should set dark background and theme colors", () => {
    expect(m.background_color).toBe("#061427");
    expect(m.theme_color).toBe("#061427");
  });

  it("should include three icons", () => {
    expect(m.icons).toHaveLength(3);
  });

  it("should include a 192px icon", () => {
    const icon = m.icons?.find((i) => i.sizes === "192x192");
    expect(icon).toBeDefined();
    expect(icon?.type).toBe("image/png");
  });

  it("should include a 512px icon", () => {
    const icon = m.icons?.find(
      (i) => i.sizes === "512x512" && i.purpose !== "maskable",
    );
    expect(icon).toBeDefined();
    expect(icon?.type).toBe("image/png");
  });

  it("should include a maskable icon", () => {
    const icon = m.icons?.find((i) => i.purpose === "maskable");
    expect(icon).toBeDefined();
    expect(icon?.sizes).toBe("512x512");
  });
});
