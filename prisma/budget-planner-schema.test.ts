import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const schemaSource = readFileSync(
  path.join(__dirname, "schema.prisma"),
  "utf-8",
);

const migrationSource = readFileSync(
  path.join(
    __dirname,
    "migrations",
    "20260511120000_add_budget_planner",
    "migration.sql",
  ),
  "utf-8",
);

function getModelBlock(source: string, modelName: string) {
  const match = source.match(
    new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`),
  );

  if (!match) {
    throw new Error(`Could not find model ${modelName}`);
  }

  return match[1];
}

describe("[Unit] BudgetPlan Prisma model", () => {
  it("should map the plan fields and relation when the model is declared", () => {
    const block = getModelBlock(schemaSource, "BudgetPlan");

    expect(block).toContain("id         Int      @id @default(autoincrement())");
    expect(block).toContain("name       String   @db.VarChar(200)");
    expect(block).toContain('startMonth DateTime @map("start_month")');
    expect(block).toContain('endMonth   DateTime @map("end_month")');
    expect(block).toContain("items BudgetPlanItem[]");
    expect(block).toContain('@@map("budget_plans")');
  });
});

describe("[Unit] BudgetPlanItem Prisma model", () => {
  it("should map every planner item field and cascade relation", () => {
    const block = getModelBlock(schemaSource, "BudgetPlanItem");

    expect(block).toContain('planId    Int      @map("plan_id")');
    expect(block).toContain("stream    String");
    expect(block).toContain('sourceId  String?  @map("source_id")');
    expect(block).toContain("label     String   @db.VarChar(255)");
    expect(block).toContain("amount    Decimal");
    expect(block).toContain("cadence   String");
    expect(block).toContain('colorCode String?  @map("color_code")');
    expect(block).toContain('sortOrder Int      @map("sort_order")');
    expect(block).toContain('isCustom  Boolean  @default(false) @map("is_custom")');
    expect(block).toContain("enabled   Boolean  @default(true)");
    expect(block).toContain(
      "plan BudgetPlan @relation(fields: [planId], references: [id], onDelete: Cascade)",
    );
    expect(block).toContain("@@index([planId, stream])");
    expect(block).toContain('@@map("budget_plan_items")');
  });
});

describe("[Unit] add budget planner migration", () => {
  it("should create planner tables, index items, and cascade delete items with the plan", () => {
    expect(migrationSource).toContain('CREATE TABLE "budget_plans"');
    expect(migrationSource).toContain('CREATE TABLE "budget_plan_items"');
    expect(migrationSource).toContain(
      'CREATE INDEX "budget_plan_items_plan_id_stream_idx"',
    );
    expect(migrationSource).toContain(
      'FOREIGN KEY ("plan_id") REFERENCES "budget_plans"("id") ON DELETE CASCADE',
    );
  });
});
