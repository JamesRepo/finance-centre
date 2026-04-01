-- AlterTable
ALTER TABLE "holidays" ADD COLUMN "assigned_month" VARCHAR(7);

UPDATE "holidays"
SET "assigned_month" = TO_CHAR("start_date" AT TIME ZONE 'UTC', 'YYYY-MM')
WHERE "assigned_month" IS NULL;

ALTER TABLE "holidays"
ALTER COLUMN "assigned_month" SET NOT NULL;
