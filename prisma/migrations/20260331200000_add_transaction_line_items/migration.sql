CREATE TABLE "transaction_line_items" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_line_items_pkey" PRIMARY KEY ("id")
);

INSERT INTO "transaction_line_items" ("id", "transaction_id", "amount", "sort_order", "created_at")
SELECT
    CONCAT("id", '_line_0'),
    "id",
    "amount",
    0,
    "created_at"
FROM "transactions";

ALTER TABLE "transaction_line_items" ADD CONSTRAINT "transaction_line_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
