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
    "20260311210514_add_debts_and_savings",
    "migration.sql",
  ),
  "utf-8",
);

const cascadeMigrationSource = readFileSync(
  path.join(
    __dirname,
    "migrations",
    "20260311211252_debt_delete_cascade",
    "migration.sql",
  ),
  "utf-8",
);

const savingsCascadeMigrationSource = readFileSync(
  path.join(
    __dirname,
    "migrations",
    "20260311212347_savings_goal_delete_cascade",
    "migration.sql",
  ),
  "utf-8",
);

const interestAmountMigrationSource = readFileSync(
  path.join(
    __dirname,
    "migrations",
    "20260311214556_add_debt_payment_interest_amount",
    "migration.sql",
  ),
  "utf-8",
);

function getEnumBlock(source: string, enumName: string) {
  const match = source.match(
    new RegExp(`enum\\s+${enumName}\\s+\\{([\\s\\S]*?)\\n\\}`),
  );

  if (!match) {
    throw new Error(`Could not find enum ${enumName}`);
  }

  return match[1];
}

function getModelBlock(source: string, modelName: string) {
  const match = source.match(
    new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`),
  );

  if (!match) {
    throw new Error(`Could not find model ${modelName}`);
  }

  return match[1];
}

describe("[Unit] debt and savings Prisma enums", () => {
  it("should define the allowed debt type values when the debt tracking models are declared", () => {
    const debtTypeBlock = getEnumBlock(schemaSource, "DebtType");

    expect(debtTypeBlock).toContain("CREDIT_CARD");
    expect(debtTypeBlock).toContain("STUDENT_LOAN");
    expect(debtTypeBlock).toContain("PERSONAL_LOAN");
    expect(debtTypeBlock).toContain("OTHER");
  });

  it("should define the allowed savings priority values when the savings goal model is declared", () => {
    const savingsPriorityBlock = getEnumBlock(schemaSource, "SavingsPriority");

    expect(savingsPriorityBlock).toContain("LOW");
    expect(savingsPriorityBlock).toContain("MEDIUM");
    expect(savingsPriorityBlock).toContain("HIGH");
  });
});

describe("[Unit] Debt Prisma model", () => {
  it("should map every persisted debt field to the expected schema columns when the model is declared", () => {
    const debtBlock = getModelBlock(schemaSource, "Debt");

    expect(debtBlock).toContain('id               Int       @id @default(autoincrement())');
    expect(debtBlock).toContain('name             String    @db.VarChar(100)');
    expect(debtBlock).toContain('debtType         DebtType  @map("debt_type")');
    expect(debtBlock).toContain('originalBalance  Decimal   @map("original_balance")');
    expect(debtBlock).toContain('interestRate     Decimal   @map("interest_rate")');
    expect(debtBlock).toContain('minimumPayment   Decimal?  @map("minimum_payment")');
    expect(debtBlock).toContain('startDate        DateTime? @map("start_date")');
    expect(debtBlock).toContain(
      'targetPayoffDate DateTime? @map("target_payoff_date")',
    );
    expect(debtBlock).toContain('isActive         Boolean   @default(true) @map("is_active")');
    expect(debtBlock).toContain('notes            String?');
    expect(debtBlock).toContain('createdAt        DateTime  @default(now()) @map("created_at")');
  });

  it("should declare the debt payments relation and snake case table name when the model is declared", () => {
    const debtBlock = getModelBlock(schemaSource, "Debt");

    expect(debtBlock).toContain("debtPayments DebtPayment[]");
    expect(debtBlock).toContain('@@map("debts")');
  });
});

describe("[Unit] DebtPayment Prisma model", () => {
  it("should declare the debt foreign key, relation, and mapped columns when the model is declared", () => {
    const debtPaymentBlock = getModelBlock(schemaSource, "DebtPayment");

    expect(debtPaymentBlock).toContain('debtId         Int      @map("debt_id")');
    expect(debtPaymentBlock).toContain('amount         Decimal');
    expect(debtPaymentBlock).toContain(
      'interestAmount Decimal  @default(0) @map("interest_amount")',
    );
    expect(debtPaymentBlock).toContain('paymentDate    DateTime @map("payment_date")');
    expect(debtPaymentBlock).toContain('note           String?');
    expect(debtPaymentBlock).toContain(
      'createdAt      DateTime @default(now()) @map("created_at")',
    );
    expect(debtPaymentBlock).toContain(
      "debt Debt @relation(fields: [debtId], references: [id], onDelete: Cascade)",
    );
    expect(debtPaymentBlock).toContain('@@map("debt_payments")');
  });
});

describe("[Unit] SavingsGoal Prisma model", () => {
  it("should map every persisted savings goal field when the model is declared", () => {
    const savingsGoalBlock = getModelBlock(schemaSource, "SavingsGoal");

    expect(savingsGoalBlock).toContain(
      'name         String           @db.VarChar(100)',
    );
    expect(savingsGoalBlock).toContain(
      'targetAmount Decimal          @map("target_amount")',
    );
    expect(savingsGoalBlock).toContain(
      'targetDate   DateTime?        @map("target_date")',
    );
    expect(savingsGoalBlock).toContain("priority     SavingsPriority?");
    expect(savingsGoalBlock).toContain(
      'createdAt    DateTime         @default(now()) @map("created_at")',
    );
  });

  it("should declare the savings contributions relation and table mapping when the model is declared", () => {
    const savingsGoalBlock = getModelBlock(schemaSource, "SavingsGoal");

    expect(savingsGoalBlock).toContain(
      "savingsContributions SavingsContribution[]",
    );
    expect(savingsGoalBlock).toContain('@@map("savings_goals")');
  });
});

describe("[Unit] SavingsContribution Prisma model", () => {
  it("should declare the savings goal foreign key, relation, and mapped columns when the model is declared", () => {
    const savingsContributionBlock = getModelBlock(
      schemaSource,
      "SavingsContribution",
    );

    expect(savingsContributionBlock).toContain('goalId           Int      @map("goal_id")');
    expect(savingsContributionBlock).toContain('amount           Decimal');
    expect(savingsContributionBlock).toContain(
      'contributionDate DateTime @map("contribution_date")',
    );
    expect(savingsContributionBlock).toContain('note             String?');
    expect(savingsContributionBlock).toContain(
      'createdAt        DateTime @default(now()) @map("created_at")',
    );
    expect(savingsContributionBlock).toContain(
      "goal SavingsGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)",
    );
    expect(savingsContributionBlock).toContain(
      '@@map("savings_contributions")',
    );
  });
});

describe("[Unit] add_debts_and_savings migration", () => {
  it("should create the debt and savings enums when the migration is applied", () => {
    expect(migrationSource).toContain(
      `CREATE TYPE "DebtType" AS ENUM ('CREDIT_CARD', 'STUDENT_LOAN', 'PERSONAL_LOAN', 'OTHER');`,
    );
    expect(migrationSource).toContain(
      `CREATE TYPE "SavingsPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');`,
    );
  });

  it("should create the new snake case tables and capped name columns when the migration is applied", () => {
    expect(migrationSource).toContain('CREATE TABLE "debts"');
    expect(migrationSource).toContain('CREATE TABLE "debt_payments"');
    expect(migrationSource).toContain('CREATE TABLE "savings_goals"');
    expect(migrationSource).toContain('CREATE TABLE "savings_contributions"');
    expect(migrationSource).toContain('"name" VARCHAR(100) NOT NULL');
  });

  it("should create the expected foreign key constraints when contribution and payment tables are created", () => {
    expect(migrationSource).toContain(
      'ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    );
    expect(migrationSource).toContain(
      'ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "savings_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    );
  });
});

describe("[Unit] debt_delete_cascade migration", () => {
  it("should change debt payment deletes to cascade when the follow-up migration is applied", () => {
    expect(cascadeMigrationSource).toContain(
      'ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_debt_id_fkey";',
    );
    expect(cascadeMigrationSource).toContain(
      'ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
  });
});

describe("[Unit] add_debt_payment_interest_amount migration", () => {
  it("should add a defaulted interest amount column to debt payments when the migration is applied", () => {
    expect(interestAmountMigrationSource).toContain(
      'ALTER TABLE "debt_payments" ADD COLUMN     "interest_amount" DECIMAL(65,30) NOT NULL DEFAULT 0;',
    );
  });
});

describe("[Unit] savings_goal_delete_cascade migration", () => {
  it("should change savings contribution deletes to cascade when the follow-up migration is applied", () => {
    expect(savingsCascadeMigrationSource).toContain(
      'ALTER TABLE "savings_contributions" DROP CONSTRAINT "savings_contributions_goal_id_fkey";',
    );
    expect(savingsCascadeMigrationSource).toContain(
      'ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
  });
});
