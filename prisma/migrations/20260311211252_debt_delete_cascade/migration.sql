-- DropForeignKey
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_debt_id_fkey";

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
