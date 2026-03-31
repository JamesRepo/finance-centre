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
    "20260331200000_add_transaction_line_items",
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

describe("[Unit] Transaction Prisma model", () => {
  it("should declare the line items relation when the model is declared", () => {
    const block = getModelBlock(schemaSource, "Transaction");

    expect(block).toContain("lineItems TransactionLineItem[]");
    expect(block).toContain('@@map("transactions")');
  });
});

describe("[Unit] TransactionLineItem Prisma model", () => {
  it("should map every persisted field to the expected schema columns", () => {
    const block = getModelBlock(schemaSource, "TransactionLineItem");

    expect(block).toContain('transactionId String   @map("transaction_id")');
    expect(block).toContain("amount        Decimal");
    expect(block).toContain('sortOrder     Int      @map("sort_order")');
    expect(block).toContain(
      'createdAt     DateTime @default(now()) @map("created_at")',
    );
  });

  it("should declare the parent relation with cascade delete and table mapping", () => {
    const block = getModelBlock(schemaSource, "TransactionLineItem");

    expect(block).toContain(
      "transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)",
    );
    expect(block).toContain('@@map("transaction_line_items")');
  });
});

describe("[Unit] add_transaction_line_items migration", () => {
  it("should create the transaction line items table and backfill one row per existing transaction", () => {
    expect(migrationSource).toContain('CREATE TABLE "transaction_line_items"');
    expect(migrationSource).toContain(
      'INSERT INTO "transaction_line_items" ("id", "transaction_id", "amount", "sort_order", "created_at")',
    );
    expect(migrationSource).toContain('FROM "transactions";');
  });

  it("should create a cascading foreign key to transactions", () => {
    expect(migrationSource).toContain(
      'ALTER TABLE "transaction_line_items" ADD CONSTRAINT "transaction_line_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
  });
});
