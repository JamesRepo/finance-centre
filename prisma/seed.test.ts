import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// ─── Seed data (mirrored from seed.ts since it doesn't export) ──────────────

const expectedCategories = [
  { name: "Groceries", colorCode: "#22c55e" },
  { name: "Eating Out", colorCode: "#f59e0b" },
  { name: "Transport", colorCode: "#3b82f6" },
  { name: "Fun / Exercise", colorCode: "#a855f7" },
  { name: "Shopping", colorCode: "#ec4899" },
  { name: "Personal Care", colorCode: "#14b8a6" },
  { name: "Pub / Going Out", colorCode: "#64748b" },
  { name: "Clothes", colorCode: "#f97316" },
  { name: "Personal Development / Tech", colorCode: "#6366f1" },
];

// ─── Parse seed.ts source to extract its actual data ─────────────────────────

const seedSource = readFileSync(
  path.join(__dirname, "seed.ts"),
  "utf-8"
);

/**
 * Extract the categories array literal from the seed source code.
 * This ensures our expected data stays in sync with the actual seed file.
 */
function extractCategoriesFromSource(source: string) {
  const match = source.match(
    /const categories\s*=\s*\[([\s\S]*?)\];/
  );
  if (!match) throw new Error("Could not find categories array in seed.ts");

  const entries: { name: string; colorCode: string }[] = [];
  const entryRegex = /\{\s*name:\s*"([^"]+)",\s*colorCode:\s*"([^"]+)"\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(match[1])) !== null) {
    entries.push({ name: m[1], colorCode: m[2] });
  }
  return entries;
}

const parsedCategories = extractCategoriesFromSource(seedSource);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Unit: Seed categories data", () => {
  it("should contain exactly 9 categories", () => {
    expect(parsedCategories).toHaveLength(9);
  });

  it("should match the expected category names in order", () => {
    const names = parsedCategories.map((c) => c.name);
    expect(names).toEqual(expectedCategories.map((c) => c.name));
  });

  it("should match the expected color codes in order", () => {
    const colors = parsedCategories.map((c) => c.colorCode);
    expect(colors).toEqual(expectedCategories.map((c) => c.colorCode));
  });

  it("should have unique category names", () => {
    const names = parsedCategories.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have unique color codes", () => {
    const colors = parsedCategories.map((c) => c.colorCode);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("should have valid 7-character hex color codes for every category", () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const category of parsedCategories) {
      expect(
        category.colorCode,
        `${category.name} has invalid color: ${category.colorCode}`
      ).toMatch(hexRegex);
    }
  });

  it("should have non-empty names for every category", () => {
    for (const category of parsedCategories) {
      expect(category.name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("Unit: Seed script structure", () => {
  it("should import PrismaClient from the generated client path", () => {
    expect(seedSource).toContain(
      'from "../src/generated/prisma/client"'
    );
  });

  it("should use upsert to be idempotent", () => {
    expect(seedSource).toContain("prisma.category.upsert");
  });

  it("should upsert by name (unique field)", () => {
    expect(seedSource).toContain("where: { name: category.name }");
  });

  it("should set isSystem: true on created categories", () => {
    expect(seedSource).toContain("isSystem: true");
  });

  it("should not update existing categories (empty update)", () => {
    expect(seedSource).toContain("update: {}");
  });

  it("should disconnect prisma and close pool in finally block", () => {
    expect(seedSource).toContain("prisma.$disconnect()");
    expect(seedSource).toContain("pool.end()");
  });

  it("should exit with code 1 on error", () => {
    expect(seedSource).toContain("process.exit(1)");
  });

  it("should log the number of seeded categories", () => {
    expect(seedSource).toContain(
      "console.log(`Seeded ${categories.length} categories`)"
    );
  });
});

describe("Unit: package.json prisma seed configuration", () => {
  const pkg = JSON.parse(
    readFileSync(
      path.join(__dirname, "..", "package.json"),
      "utf-8"
    )
  );

  it("should have a prisma.seed field", () => {
    expect(pkg.prisma).toBeDefined();
    expect(pkg.prisma.seed).toBeDefined();
  });

  it("should run the seed script via tsx", () => {
    expect(pkg.prisma.seed).toBe("tsx prisma/seed.ts");
  });

  it("should have tsx in devDependencies", () => {
    expect(pkg.devDependencies.tsx).toBeDefined();
  });
});

describe("Unit: prisma.config.ts seed configuration", () => {
  const configSource = readFileSync(
    path.join(__dirname, "..", "prisma.config.ts"),
    "utf-8"
  );

  it("should define a seed command in migrations config", () => {
    expect(configSource).toContain("seed:");
  });

  it("should reference the seed.ts file", () => {
    expect(configSource).toMatch(/seed.*prisma\/seed\.ts/);
  });
});

describe("Unit: Seed data completeness against requirements", () => {
  const requiredCategories: Record<string, string> = {
    "Groceries": "#22c55e",
    "Eating Out": "#f59e0b",
    "Transport": "#3b82f6",
    "Fun / Exercise": "#a855f7",
    "Shopping": "#ec4899",
    "Personal Care": "#14b8a6",
    "Pub / Going Out": "#64748b",
    "Clothes": "#f97316",
    "Personal Development / Tech": "#6366f1",
  };

  for (const [name, color] of Object.entries(requiredCategories)) {
    it(`should include "${name}" with color ${color}`, () => {
      const found = parsedCategories.find((c) => c.name === name);
      expect(found, `Missing category: ${name}`).toBeDefined();
      expect(found!.colorCode).toBe(color);
    });
  }

  it("should not include any extra categories beyond the 9 required", () => {
    const requiredNames = Object.keys(requiredCategories);
    for (const category of parsedCategories) {
      expect(
        requiredNames,
        `Unexpected category: ${category.name}`
      ).toContain(category.name);
    }
  });
});
