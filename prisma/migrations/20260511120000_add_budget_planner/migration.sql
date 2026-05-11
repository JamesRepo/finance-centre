-- CreateTable
CREATE TABLE "budget_plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "start_month" TIMESTAMP(3) NOT NULL,
    "end_month" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_plan_items" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "stream" TEXT NOT NULL,
    "source_id" TEXT,
    "label" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "cadence" TEXT NOT NULL,
    "color_code" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_plan_items_plan_id_stream_idx" ON "budget_plan_items"("plan_id", "stream");

-- AddForeignKey
ALTER TABLE "budget_plan_items" ADD CONSTRAINT "budget_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "budget_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
