DELETE FROM "subscriptions"
WHERE "is_active" = false;

ALTER TABLE "subscriptions"
RENAME COLUMN "next_payment_date" TO "payment_date";

ALTER TABLE "subscriptions"
ADD COLUMN "payment_month" TIMESTAMP(3);

UPDATE "subscriptions"
SET "payment_month" = date_trunc('month', "payment_date");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "subscriptions"
    GROUP BY "name", "payment_month"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot apply rework_subscriptions migration: duplicate active subscriptions exist for the same name and payment_month. Resolve duplicates manually before retrying.';
  END IF;
END $$;

ALTER TABLE "subscriptions"
ALTER COLUMN "payment_month" SET NOT NULL;

ALTER TABLE "subscriptions"
DROP COLUMN "is_active";

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_name_payment_month_key" ON "subscriptions"("name", "payment_month");
