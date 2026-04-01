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
    "20260311221446_add_fixed_costs_income_holidays_settings",
    "migration.sql",
  ),
  "utf-8",
);

const subscriptionReworkMigrationSource = readFileSync(
  path.join(
    __dirname,
    "migrations",
    "20260401185742_rework_subscriptions",
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

// ====== HousingExpense ======

describe("[Unit] HousingExpense Prisma model", () => {
  it("should map every persisted field to the expected schema columns when the model is declared", () => {
    const block = getModelBlock(schemaSource, "HousingExpense");

    expect(block).toContain(
      "id           Int      @id @default(autoincrement())",
    );
    expect(block).toContain('expenseType  String   @map("expense_type")');
    expect(block).toContain("amount       Decimal");
    expect(block).toContain('expenseMonth DateTime @map("expense_month")');
    expect(block).toContain("frequency    String");
    expect(block).toContain(
      'createdAt    DateTime @default(now()) @map("created_at")',
    );
  });

  it("should declare the unique constraint and table mapping when the model is declared", () => {
    const block = getModelBlock(schemaSource, "HousingExpense");

    expect(block).toContain("@@unique([expenseType, expenseMonth])");
    expect(block).toContain('@@map("housing_expenses")');
  });
});

// ====== Subscription ======

describe("[Unit] Subscription Prisma model", () => {
  it("should map every persisted field to the expected schema columns when the model is declared", () => {
    const block = getModelBlock(schemaSource, "Subscription");

    expect(block).toContain("id           Int      @id @default(autoincrement())");
    expect(block).toContain("name         String   @db.VarChar(200)");
    expect(block).toContain("amount       Decimal");
    expect(block).toContain("frequency    String");
    expect(block).toContain('paymentDate  DateTime @map("payment_date")');
    expect(block).toContain('paymentMonth DateTime @map("payment_month")');
    expect(block).toContain("description  String?");
    expect(block).toContain('createdAt    DateTime @default(now()) @map("created_at")');
  });

  it("should declare the unique constraint and table mapping when the model is declared", () => {
    const block = getModelBlock(schemaSource, "Subscription");

    expect(block).toContain("@@unique([name, paymentMonth])");
    expect(block).toContain('@@map("subscriptions")');
  });
});

// ====== IncomeSource ======

describe("[Unit] IncomeSource Prisma model", () => {
  it("should map every persisted field to the expected schema columns when the model is declared", () => {
    const block = getModelBlock(schemaSource, "IncomeSource");

    expect(block).toContain(
      "id                   Int      @id @default(autoincrement())",
    );
    expect(block).toContain('incomeType           String   @map("income_type")');
    expect(block).toContain("description          String?");
    expect(block).toContain('grossAmount          Decimal  @map("gross_amount")');
    expect(block).toContain('netAmount            Decimal  @map("net_amount")');
    expect(block).toContain('incomeDate           DateTime @map("income_date")');
    expect(block).toContain(
      'isRecurring          Boolean  @default(false) @map("is_recurring")',
    );
    expect(block).toContain(
      'recurrenceFrequency  String?  @map("recurrence_frequency")',
    );
    expect(block).toContain(
      'isActive             Boolean  @default(true) @map("is_active")',
    );
    expect(block).toContain(
      'createdAt            DateTime @default(now()) @map("created_at")',
    );
  });

  it("should declare the income deductions relation and table mapping when the model is declared", () => {
    const block = getModelBlock(schemaSource, "IncomeSource");

    expect(block).toContain("incomeDeductions IncomeDeduction[]");
    expect(block).toContain('@@map("income_sources")');
  });
});

// ====== IncomeDeduction ======

describe("[Unit] IncomeDeduction Prisma model", () => {
  it("should map every persisted field to the expected schema columns when the model is declared", () => {
    const block = getModelBlock(schemaSource, "IncomeDeduction");

    expect(block).toContain(
      "id              Int      @id @default(autoincrement())",
    );
    expect(block).toContain(
      'incomeSourceId  Int      @map("income_source_id")',
    );
    expect(block).toContain(
      'deductionType   String   @map("deduction_type")',
    );
    expect(block).toContain("name            String   @db.VarChar(255)");
    expect(block).toContain("amount          Decimal");
    expect(block).toContain(
      'isPercentage    Boolean  @default(false) @map("is_percentage")',
    );
    expect(block).toContain(
      'percentageValue Decimal? @map("percentage_value")',
    );
    expect(block).toContain(
      'isActive        Boolean  @default(true) @map("is_active")',
    );
    expect(block).toContain(
      'createdAt       DateTime @default(now()) @map("created_at")',
    );
  });

  it("should declare the income source relation with cascade delete and table mapping when the model is declared", () => {
    const block = getModelBlock(schemaSource, "IncomeDeduction");

    expect(block).toContain(
      "incomeSource IncomeSource @relation(fields: [incomeSourceId], references: [id], onDelete: Cascade)",
    );
    expect(block).toContain('@@map("income_deductions")');
  });
});

// ====== Holiday ======

describe("[Unit] Holiday Prisma model", () => {
  it("should map every persisted field to the expected schema columns when the model is declared", () => {
    const block = getModelBlock(schemaSource, "Holiday");

    expect(block).toContain(
      "id          Int      @id @default(autoincrement())",
    );
    expect(block).toContain("name        String   @db.VarChar(200)");
    expect(block).toContain("destination String   @db.VarChar(200)");
    expect(block).toContain('startDate   DateTime @map("start_date")');
    expect(block).toContain('endDate     DateTime @map("end_date")');
    expect(block).toContain("description String?");
    expect(block).toContain(
      'isActive    Boolean  @default(true) @map("is_active")',
    );
    expect(block).toContain(
      'createdAt   DateTime @default(now()) @map("created_at")',
    );
  });

  it("should declare the holiday expenses relation and table mapping when the model is declared", () => {
    const block = getModelBlock(schemaSource, "Holiday");

    expect(block).toContain("holidayExpenses HolidayExpense[]");
    expect(block).toContain('@@map("holidays")');
  });
});

// ====== HolidayExpense ======

describe("[Unit] HolidayExpense Prisma model", () => {
  it("should map every persisted field to the expected schema columns when the model is declared", () => {
    const block = getModelBlock(schemaSource, "HolidayExpense");

    expect(block).toContain(
      "id          Int      @id @default(autoincrement())",
    );
    expect(block).toContain('holidayId   Int      @map("holiday_id")');
    expect(block).toContain('expenseType String   @map("expense_type")');
    expect(block).toContain("description String   @db.VarChar(500)");
    expect(block).toContain("amount      Decimal");
    expect(block).toContain('expenseDate DateTime @map("expense_date")');
    expect(block).toContain("notes       String?");
    expect(block).toContain(
      'createdAt   DateTime @default(now()) @map("created_at")',
    );
  });

  it("should declare the holiday relation with cascade delete and table mapping when the model is declared", () => {
    const block = getModelBlock(schemaSource, "HolidayExpense");

    expect(block).toContain(
      "holiday Holiday @relation(fields: [holidayId], references: [id], onDelete: Cascade)",
    );
    expect(block).toContain('@@map("holiday_expenses")');
  });
});

// ====== Settings ======

describe("[Unit] Settings Prisma model", () => {
  it("should map every persisted field to the expected schema columns when the model is declared", () => {
    const block = getModelBlock(schemaSource, "Settings");

    expect(block).toContain(
      "id                 Int      @id @default(autoincrement())",
    );
    expect(block).toContain('currency           String   @default("GBP")');
    expect(block).toContain('locale             String   @default("en-GB")');
    expect(block).toContain(
      'monthlyBudgetTotal Decimal? @map("monthly_budget_total")',
    );
    expect(block).toContain(
      'updatedAt          DateTime @updatedAt @map("updated_at")',
    );
  });

  it("should declare the table mapping when the model is declared", () => {
    const block = getModelBlock(schemaSource, "Settings");

    expect(block).toContain('@@map("settings")');
  });
});

// ====== Migration ======

describe("[Unit] add_fixed_costs_income_holidays_settings migration", () => {
  it("should create all new snake case tables when the migration is applied", () => {
    expect(migrationSource).toContain('CREATE TABLE "housing_expenses"');
    expect(migrationSource).toContain('CREATE TABLE "subscriptions"');
    expect(migrationSource).toContain('CREATE TABLE "income_sources"');
    expect(migrationSource).toContain('CREATE TABLE "income_deductions"');
    expect(migrationSource).toContain('CREATE TABLE "holidays"');
    expect(migrationSource).toContain('CREATE TABLE "holiday_expenses"');
    expect(migrationSource).toContain('CREATE TABLE "settings"');
  });

  it("should create the housing expense unique constraint when the migration is applied", () => {
    expect(migrationSource).toContain(
      'CREATE UNIQUE INDEX "housing_expenses_expense_type_expense_month_key" ON "housing_expenses"("expense_type", "expense_month")',
    );
  });

  it("should create the expected foreign key constraints with cascade delete when the migration is applied", () => {
    expect(migrationSource).toContain(
      'ALTER TABLE "income_deductions" ADD CONSTRAINT "income_deductions_income_source_id_fkey" FOREIGN KEY ("income_source_id") REFERENCES "income_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    expect(migrationSource).toContain(
      'ALTER TABLE "holiday_expenses" ADD CONSTRAINT "holiday_expenses_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    );
  });

  it("should create the capped varchar columns with correct lengths when the migration is applied", () => {
    expect(migrationSource).toContain('"name" VARCHAR(200) NOT NULL');
    expect(migrationSource).toContain('"destination" VARCHAR(200) NOT NULL');
    expect(migrationSource).toContain('"description" VARCHAR(500) NOT NULL');
    expect(migrationSource).toContain('"name" VARCHAR(255) NOT NULL');
  });

  it("should set the correct default values when the migration is applied", () => {
    expect(migrationSource).toContain("DEFAULT true");
    expect(migrationSource).toContain("DEFAULT false");
    expect(migrationSource).toContain("DEFAULT 'GBP'");
    expect(migrationSource).toContain("DEFAULT 'en-GB'");
  });
});

describe("[Unit] rework_subscriptions migration", () => {
  it("should backfill payment_month from payment_date and preserve active rows for manual duplicate resolution", () => {
    expect(subscriptionReworkMigrationSource).toContain(
      'ALTER TABLE "subscriptions"\nRENAME COLUMN "next_payment_date" TO "payment_date";',
    );
    expect(subscriptionReworkMigrationSource).toContain(
      `UPDATE "subscriptions"
SET "payment_month" = date_trunc('month', "payment_date");`,
    );
    expect(subscriptionReworkMigrationSource).toContain(
      "duplicate active subscriptions exist for the same name and payment_month",
    );
    expect(subscriptionReworkMigrationSource).not.toContain(
      'DELETE FROM "subscriptions"\nUSING ranked_subscriptions',
    );
  });

  it("should remove inactive subscriptions and add the new unique index when the migration is applied", () => {
    expect(subscriptionReworkMigrationSource).toContain(
      'DELETE FROM "subscriptions"\nWHERE "is_active" = false;',
    );
    expect(subscriptionReworkMigrationSource).toContain(
      'ALTER TABLE "subscriptions"\nDROP COLUMN "is_active";',
    );
    expect(subscriptionReworkMigrationSource).toContain(
      'CREATE UNIQUE INDEX "subscriptions_name_payment_month_key" ON "subscriptions"("name", "payment_month")',
    );
  });
});
